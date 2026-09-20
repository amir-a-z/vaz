"""
Robust Markdown/LaTeX -> native Word OMML DOCX generator.
Designed for Persian/English mixed text, Markdown tables, code blocks,
inline/display LaTeX, and common LaTeX environments.
"""

from __future__ import annotations

import html
import os
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional
from urllib.parse import unquote

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from lxml import etree

try:
    from latex2mathml.converter import convert as latex_to_mathml
except ImportError:
    latex_to_mathml = None

try:
    import mathml2omml
except ImportError:
    mathml2omml = None


M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
MML_NS = "http://www.w3.org/1998/Math/MathML"
NS = {"m": M_NS, "w": W_NS, "mml": MML_NS}


class MathConversionError(ValueError):
    pass


@dataclass(frozen=True)
class MathToken:
    kind: Literal["text", "inline", "display"]
    value: str


@dataclass(frozen=True)
class Block:
    kind: Literal["heading", "paragraph", "table", "code", "blank"]
    value: object
    level: int = 0


class MathScanner:
    """Scanner for $$, \\[...\\], \\(...\\), $, and common LaTeX environments."""

    ENV_NAMES = {
        "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix",
        "array", "aligned", "alignedat", "gathered", "cases", "split",
        "smallmatrix", "equation", "equation*", "displaymath", "align",
        "align*", "multline", "multline*", "gather", "gather*"
    }

    @staticmethod
    def _escaped(s: str, i: int) -> bool:
        count = 0
        i -= 1
        while i >= 0 and s[i] == "\\":
            count += 1
            i -= 1
        return count % 2 == 1

    @staticmethod
    def _find(text: str, start: int, terminator: str) -> Optional[int]:
        pos = start
        while True:
            pos = text.find(terminator, pos)
            if pos < 0:
                return None
            if not MathScanner._escaped(text, pos):
                return pos
            pos += 1

    @classmethod
    def _find_single_dollar(cls, text: str, start: int) -> Optional[int]:
        pos = start
        while pos < len(text):
            if text[pos] == "\n":
                return None
            if text[pos] == "$" and not cls._escaped(text, pos):
                if pos + 1 < len(text) and text[pos + 1] == "$":
                    pos += 2
                    continue
                if pos == start:
                    return None
                return pos
            pos += 1
        return None

    @classmethod
    def scan(cls, text: str) -> list[MathToken]:
        out: list[MathToken] = []
        buf: list[str] = []
        i = 0

        def flush() -> None:
            if buf:
                out.append(MathToken("text", "".join(buf)))
                buf.clear()

        while i < len(text):
            # 0. Custom / display math with various openers and closers (e.g. \[ ... \cr], \ [ ... \cr], \\[ ... \\cr], etc.)
            matched_custom = False
            for op in (r"\ [", r"\[", r"\\ [", r"\\\["):
                if text.startswith(op, i):
                    for cl in (r"\cr]", r"\cr ]", r"\\cr]", r"\\cr ]"):
                        end = cls._find(text, i + len(op), cl)
                        if end is not None:
                            val = text[i + len(op):end].strip()
                            val = OMMLConverter._decode(val)
                            if val:
                                flush()
                                out.append(MathToken("display", val))
                            i = end + len(cl)
                            matched_custom = True
                            break
                    if matched_custom:
                        break
            if matched_custom:
                continue

            # 1. Display math: $$ ... $$
            if text.startswith("$$", i) and not cls._escaped(text, i):
                end = cls._find(text, i + 2, "$$")
                if end is not None:
                    val = text[i + 2:end].strip()
                    val = OMMLConverter._decode(val)
                    if val:
                        flush()
                        out.append(MathToken("display", val))
                    i = end + 2
                    continue

            # 2. Display math with doubled backslashes: \\[ ... \\]
            if text.startswith(r"\\\[", i):
                end = cls._find(text, i + 4, r"\\\]")
                if end is not None:
                    val = text[i + 4:end].strip()
                    val = OMMLConverter._decode(val)
                    if val:
                        flush()
                        out.append(MathToken("display", val))
                    i = end + 4
                    continue

            # 3. Display math with standard backslashes: \[ ... \]
            if text.startswith(r"\[", i) and not cls._escaped(text, i):
                end = cls._find(text, i + 2, r"\]")
                if end is not None:
                    val = text[i + 2:end].strip()
                    val = OMMLConverter._decode(val)
                    if val:
                        flush()
                        out.append(MathToken("display", val))
                    i = end + 2
                    continue

            # 4. Inline math with doubled backslashes: \\( ... \\)
            if text.startswith(r"\\(", i):
                end = cls._find(text, i + 3, r"\\)")
                if end is not None:
                    val = text[i + 3:end].strip()
                    val = OMMLConverter._decode(val)
                    if val:
                        flush()
                        out.append(MathToken("inline", val))
                    i = end + 3
                    continue

            # 5. Inline math with standard backslashes: \( ... \)
            if text.startswith(r"\(", i) and not cls._escaped(text, i):
                end = cls._find(text, i + 2, r"\)")
                if end is not None:
                    val = text[i + 2:end].strip()
                    val = OMMLConverter._decode(val)
                    if val:
                        flush()
                        out.append(MathToken("inline", val))
                    i = end + 2
                    continue

            # 6. Single dollar inline math: $ ... $
            if text[i] == "$" and not cls._escaped(text, i):
                end = cls._find_single_dollar(text, i + 1)
                if end is not None:
                    val = text[i + 1:end].strip()
                    val = OMMLConverter._decode(val)
                    if val:
                        flush()
                        out.append(MathToken("inline", val))
                    i = end + 1
                    continue

            # 7. LaTeX environments: \begin{env} ... \end{env} or \\begin{env} ... \\end{env}
            env_prefix = None
            if text.startswith(r"\\begin{", i):
                env_prefix = r"\\begin{"
                close_prefix = r"\\end{"
            elif text.startswith(r"\begin{", i) and not cls._escaped(text, i):
                env_prefix = r"\begin{"
                close_prefix = r"\end{"

            if env_prefix:
                m = re.match(r"(?:\\\\|\\)begin\{([^}]+)\}", text[i:])
                if m and m.group(1) in cls.ENV_NAMES:
                    env = m.group(1)
                    close = rf"{close_prefix}{env}}}"
                    end = cls._find(text, i + len(m.group(0)), close)
                    if end is not None:
                        val = text[i:end + len(close)].strip()
                        if val:
                            flush()
                            out.append(MathToken("display", val))
                        i = end + len(close)
                        continue

            buf.append(text[i])
            i += 1

        flush()
        return out


class OMMLConverter:
    """LaTeX -> MathML -> native Word OMML."""

    def __init__(self, xsl_path: str | os.PathLike | None = None):
        self._transform = None
        try:
            path = self._resolve_xsl_path(xsl_path)
            self._transform = self._load_transform(path)
        except FileNotFoundError:
            pass

    @staticmethod
    def _resolve_xsl_path(explicit):
        here = Path(__file__).resolve().parent
        candidates = []

        if explicit:
            candidates.append(Path(explicit))

        env_path = os.environ.get("MML2OMML_XSL")
        if env_path:
            candidates.append(Path(env_path))

        candidates.extend([
            here / "resources" / "MML2OMML.XSL",
            here / "MML2OMML.XSL",
        ])

        for env_name in ("ProgramFiles", "ProgramFiles(x86)"):
            base = os.environ.get(env_name)
            if not base:
                continue
            b = Path(base)
            candidates.extend([
                b / "Microsoft Office" / "root" / "Office16" / "MML2OMML.XSL",
                b / "Microsoft Office" / "root" / "Office15" / "MML2OMML.XSL",
                b / "Microsoft Office" / "root" / "Office14" / "MML2OMML.XSL",
                b / "Microsoft Office" / "Office16" / "MML2OMML.XSL",
                b / "Microsoft Office" / "Office15" / "MML2OMML.XSL",
                b / "Microsoft Office" / "Office14" / "MML2OMML.XSL",
            ])

        for path in candidates:
            try:
                if path.is_file():
                    return path.resolve()
            except OSError:
                continue

        raise FileNotFoundError("MML2OMML.XSL not found")

    @staticmethod
    def _load_transform(path):
        parser = etree.XMLParser(
            resolve_entities=False, no_network=True, recover=False
        )
        doc = etree.parse(str(path), parser)
        access = etree.XSLTAccessControl(
            read_file=True,
            write_file=False,
            create_dir=False,
            read_network=False,
            write_network=False,
        )
        return etree.XSLT(doc, access_control=access)

    @staticmethod
    def _decode(source: str) -> str:
        s = unquote(html.unescape(str(source)))
        s = re.sub(r"[\u200b\ufeff\u200c\u200e\u200f]", "", s).strip()

        changed = True
        while changed and s:
            changed = False
            # Pairs of delimiters
            pairs = [
                (r"\ [", r"\cr]"), (r"\[", r"\cr]"), (r"\ [", r"\cr ]"), (r"\[", r"\cr ]"),
                (r"\\ [", r"\\cr]"), (r"\\\[", r"\\cr]"), (r"\\\[", r"\\cr ]"),
                (r"\\\[", r"\\\]"), (r"\[", r"\]"), (r"\ [", r"\]"),
                ("$$", "$$"), ("$", "$"),
                (r"\\\(", r"\\\)"), (r"\(", r"\)"), (r"\ (", r"\)"), (r"\ (", r"\ )"),
            ]
            for left, right in pairs:
                if s.startswith(left) and s.endswith(right) and len(s) >= len(left) + len(right):
                    s = s[len(left):len(s) - len(right)].strip()
                    changed = True
                    break

            # Dangling single artifacts at edges
            for pfx in (r"\\\[", r"\\ [", r"\ [", r"\[", r"\\\(", r"\(", r"\ ("):
                if s.startswith(pfx):
                    s = s[len(pfx):].strip()
                    changed = True
                    break

            for sfx in (r"\\cr ]", r"\\cr]", r"\cr ]", r"\cr]", r"\\\]", r"\]", r"\ ]", r"\\cr", r"\cr", r"\\)", r"\)", r"\ )"):
                if s.endswith(sfx):
                    s = s[:-len(sfx)].strip()
                    changed = True
                    break

            while s.startswith("$"):
                s = s[1:].strip()
                changed = True
            while s.endswith("$"):
                s = s[:-1].strip()
                changed = True

        return s

    @classmethod
    def _variants(cls, source: str):
        s = cls._decode(source)
        if not s:
            return

        seen = set()

        for _ in range(4):
            if s and s not in seen:
                seen.add(s)
                yield s

            # Handle JSON/HTML/copy-paste doubled backslashes before commands (e.g. \\frac -> \frac)
            # but preserve \\ at the end of rows inside matrices/arrays!
            s_new = re.sub(r"\\\\([A-Za-z])", r"\\\1", s)
            if s_new == s:
                break
            s = s_new

    @staticmethod
    def _normalize_mathml(mathml: str):
        # Escape any unescaped ampersands in generated MathML
        mathml = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);)", "&amp;", mathml)

        parser = etree.XMLParser(
            resolve_entities=False,
            no_network=True,
            recover=True,
            remove_blank_text=True,
        )

        try:
            root = etree.fromstring(mathml.encode("utf-8"), parser)
        except etree.XMLSyntaxError as exc:
            raise MathConversionError("Generated MathML is not valid XML") from exc

        if root is None or etree.QName(root).localname != "math":
            raise MathConversionError("MathML root is not <math>")

        if etree.QName(root).namespace != MML_NS:
            for node in root.iter():
                if isinstance(node.tag, str):
                    q = etree.QName(node)
                    if q.namespace is None:
                        node.tag = f"{{{MML_NS}}}{q.localname}"
            etree.cleanup_namespaces(root)

        for node in root.xpath(
            ".//mml:annotation | .//mml:annotation-xml", namespaces=NS
        ):
            parent = node.getparent()
            if parent is not None:
                parent.remove(node)

        return root

    @staticmethod
    def _fix_common_latex(source: str) -> str:
        s = source.strip()

        # Multi-equation and alignment environments unsupported by latex2mathml -> matrix
        for env in ("aligned", "align*", "align", "gather*", "gather", "split", "eqnarray*", "eqnarray"):
            s = s.replace(rf"\begin{{{env}}}", r"\begin{matrix}")
            s = s.replace(rf"\end{{{env}}}", r"\end{matrix}")
            s = s.replace(rf"\\begin{{{env}}}", r"\begin{matrix}")
            s = s.replace(rf"\\end{{{env}}}", r"\end{matrix}")

        # Alignment tabs in multi-line equations (& = -> = or bare &=)
        s = re.sub(r"&\s*=", "=", s)

        # Convert row break \\ to \cr in matrix/cases/array/etc when not immediately preceding a letter
        s = re.sub(r"\\\\(?=[^a-zA-Z]|$)", lambda _m: r"\cr ", s)

        # Common copy/paste/OCR artifacts.
        s = s.replace(r"\dfrac", r"\frac")
        s = s.replace(r"\tfrac", r"\frac")
        s = s.replace(r"\left.", "")
        s = s.replace(r"\right.", "")

        # Bold math macros
        s = re.sub(r"\\(?:bm|boldsymbol)\b", r"\\mathbf", s)

        # Relational symbols
        s = re.sub(r"\\le\b", r"\\leq", s)
        s = re.sub(r"\\ge\b", r"\\geq", s)

        # Function names frequently found in Persian educational text.
        for old, new in {
            "Ln": r"\ln",
            "Log": r"\log",
            "Sin": r"\sin",
            "Cos": r"\cos",
            "Tan": r"\tan",
        }.items():
            s = re.sub(rf"(?<!\\)\b{old}\b", lambda _m, rep=new: rep, s)

        # Map tabular to array so MathML/OMML processor can construct matrix
        s = re.sub(r"\\begin\{tabular\}", r"\\begin{array}", s)
        s = re.sub(r"\\end\{tabular\}", r"\\end{array}", s)

        # Remove any lingering \cr] or \cr \ ] or \ [ or \[ at formula edges
        s = re.sub(r"^(?:\\ ?\[|\\\\\[)\s*", "", s)
        s = re.sub(r"\s*(?:\\cr\s*\]|\\\\cr\s*\]|\\ ?\]|\\\\\])$", "", s)

        s = re.sub(r"[\u200b\u200c\ufeff\u200e\u200f]", "", s)

        return s

    def latex_to_mathml(self, source: str):
        if latex_to_mathml is None:
            raise MathConversionError(
                "کتابخانه latex2mathml نصب نیست. "
                "اجرا کنید: python -m pip install latex2mathml"
            )

        last_error = None
        fixed = self._fix_common_latex(source)

        for variant in self._variants(fixed):
            try:
                raw = latex_to_mathml(variant)
                return self._normalize_mathml(raw)
            except Exception as exc:
                last_error = exc

        raise MathConversionError(
            f"Unsupported LaTeX: {source[:160]}"
        ) from last_error

    def mathml_to_omml(self, root):
        if self._transform is not None:
            try:
                result = self._transform(root)
                out = result.getroot()
                if out is None:
                    raise ValueError("empty XSLT result")

                if etree.QName(out).localname == "oMathPara":
                    matches = out.xpath("./m:oMath", namespaces=NS)
                    if not matches:
                        raise ValueError("invalid oMathPara: no oMath children")
                    out = matches[0]
                elif etree.QName(out).localname != "oMath":
                    raise ValueError("unexpected OMML root")

                etree.cleanup_namespaces(out)
                return etree.fromstring(
                    etree.tostring(out, encoding="utf-8")
                )
            except Exception:
                pass

        if mathml2omml is not None:
            try:
                xml_str = etree.tostring(root, encoding="unicode")
                converted = mathml2omml.convert(xml_str)

                wrapper = etree.fromstring(
                    f'<root xmlns:m="{M_NS}">{converted}</root>'.encode("utf-8")
                )
                omath = wrapper.find(qn("m:oMath"))
                if omath is None:
                    raise ValueError("m:oMath not found")

                return etree.fromstring(
                    etree.tostring(omath, encoding="utf-8")
                )
            except Exception as exc:
                pass

        raise MathConversionError(
            "هیچ مبدل MathML -> OMML فعال نیست. "
            "MML2OMML.XSL یا mathml2omml را نصب/تنظیم کنید."
        )

    def convert(self, source: str, input_format="latex"):
        if input_format == "mathml":
            root = self._normalize_mathml(source)
        else:
            root = self.latex_to_mathml(source)
        return self.mathml_to_omml(root)


class TextParser:
    """Block parser preserving source order."""

    CODE_FENCE = re.compile(
        r"^\s*(```+|~~~+)\s*([\w+-]*)\s*$"
    )

    @staticmethod
    def detect_language(text):
        count = len(re.findall(r"[\u0600-\u06FF]", text))
        return "persian" if count > 10 else "english"

    @staticmethod
    def _table_row(line):
        s = line.strip()
        if "|" not in s:
            return None

        if s.startswith("|"):
            s = s[1:]
        if s.endswith("|"):
            s = s[:-1]

        cells = []
        buf = []
        escaped = False

        for ch in s:
            if escaped:
                buf.append(ch)
                escaped = False
            elif ch == "\\":
                escaped = True
                buf.append(ch)
            elif ch == "|":
                cells.append("".join(buf).strip())
                buf = []
            else:
                buf.append(ch)

        cells.append("".join(buf).strip())
        return cells if len(cells) >= 2 else None

    @staticmethod
    def _is_separator(row):
        return bool(row) and all(
            re.fullmatch(r":?-{3,}:?", cell.strip())
            for cell in row
        )

    @classmethod
    def parse_blocks(cls, text: str):
        lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        blocks = []
        paragraph = []
        i = 0

        def flush():
            nonlocal paragraph
            if paragraph:
                value = "\n".join(paragraph).strip()
                if value:
                    blocks.append(Block("paragraph", value))
                paragraph = []

        while i < len(lines):
            line = lines[i]

            # Fenced code block.
            fence = cls.CODE_FENCE.match(line)
            if fence:
                flush()
                marker = fence.group(1)
                language = fence.group(2)
                content = []
                j = i + 1

                while j < len(lines):
                    if re.match(
                        rf"^\s*{re.escape(marker[0])}{{{len(marker)},}}\s*$",
                        lines[j],
                    ):
                        break
                    content.append(lines[j])
                    j += 1

                blocks.append(Block("code", ("\n".join(content), language)))
                i = min(j + 1, len(lines))
                continue

            # Heading.
            hm = re.match(r"^\s*(#{1,6})\s+(.+?)\s*$", line)
            if hm:
                flush()
                blocks.append(
                    Block("heading", hm.group(2), len(hm.group(1)))
                )
                i += 1
                continue

            # Markdown table.
            row = cls._table_row(line)
            if row is not None and i + 1 < len(lines):
                row2 = cls._table_row(lines[i + 1])
                if row2 is not None and cls._is_separator(row2):
                    flush()
                    rows = [row]
                    i += 2

                    while i < len(lines):
                        r = cls._table_row(lines[i])
                        if r is None:
                            break
                        rows.append(r)
                        i += 1

                    blocks.append(Block("table", rows))
                    continue

            # Tab-separated table.
            if "\t" in line and len(line.split("\t")) >= 2:
                cells = [c.strip() for c in line.split("\t")]
                tab_rows = [cells]
                j = i + 1
                while j < len(lines) and "\t" in lines[j] and len(lines[j].split("\t")) >= 2:
                    tab_rows.append([c.strip() for c in lines[j].split("\t")])
                    j += 1
                if len(tab_rows) >= 2:
                    flush()
                    blocks.append(Block("table", tab_rows))
                    i = j
                    continue

            # Skip stray backslash lines (e.g., \ or \\ or \ ) inserted before math
            if line.strip() in ("\\", "\\\\", "\\ ", "\\\\ "):
                i += 1
                continue

            # Bullet list item.
            bullet_m = re.match(r"^\s*([*\-•])\s+(.+)$", line)
            if bullet_m:
                flush()
                blocks.append(Block("list_item", bullet_m.group(2).strip(), bullet_m.group(1)))
                i += 1
                continue

            # Numbered list item.
            num_m = re.match(r"^\s*([0-9]+|[\u06F0-\u06F9]+)[.)\-]\s+(.+)$", line)
            if num_m and not line.strip().startswith("#"):
                flush()
                blocks.append(Block("numbered_item", num_m.group(2).strip(), num_m.group(1)))
                i += 1
                continue

            # 1. Single-line display math ($$ ... $$, \[ ... \], or \\[ ... \\], or \ [ ... \cr], etc.)
            st = line.strip()
            is_single_display = False
            for op in (r"$$", r"\ [", r"\[", r"\\ [", r"\\\["):
                if st.startswith(op):
                    for cl in (r"$$", r"\cr]", r"\cr ]", r"\\cr]", r"\\cr ]", r"\]", r"\\\]"):
                        if st.endswith(cl) and len(st) >= len(op) + len(cl):
                            clean_val = OMMLConverter._decode(st)
                            if clean_val:
                                flush()
                                blocks.append(Block("paragraph", f"$$\n{clean_val}\n$$"))
                                is_single_display = True
                                break
                    if is_single_display:
                        break
            if is_single_display:
                i += 1
                continue

            # 2. Multi-line display math block ($$ ... $$)
            if st.startswith("$$") and st.count("$$") % 2 == 1:
                flush()
                math_lines = [line]
                j = i + 1
                found_end = False
                while j < len(lines):
                    math_lines.append(lines[j])
                    if "$$" in lines[j]:
                        found_end = True
                        j += 1
                        break
                    j += 1
                if found_end:
                    clean_val = OMMLConverter._decode("\n".join(math_lines).strip())
                    blocks.append(Block("paragraph", f"$$\n{clean_val}\n$$"))
                    i = j
                    continue

            # 3. Multi-line display math block (\[ ... \] or \ [ ... \cr] or \\[ ... \\])
            is_block_opener = False
            matched_closers = []
            for op, cls_opts in [
                (r"\[", [r"\]", r"\cr]", r"\cr ]", r"\\cr]"]),
                (r"\ [", [r"\cr]", r"\cr ]", r"\]", r"\\cr]"]),
                (r"\\\[", [r"\\\]", r"\]", r"\\cr]", r"\cr]"]),
            ]:
                if st == op or st.startswith(op):
                    is_block_opener = True
                    matched_closers = cls_opts
                    break

            if is_block_opener:
                flush()
                math_lines = [line]
                j = i + 1
                found_end = False
                while j < len(lines):
                    math_lines.append(lines[j])
                    if any(cl in lines[j] for cl in matched_closers):
                        found_end = True
                        j += 1
                        break
                    j += 1
                if found_end:
                    clean_val = OMMLConverter._decode("\n".join(math_lines).strip())
                    blocks.append(Block("paragraph", f"$$\n{clean_val}\n$$"))
                    i = j
                    continue

            # 4. LaTeX environment (e.g., \begin{array}, \begin{matrix}, \begin{cases}, etc.)
            env_m = re.search(r"(?:\\\\|\\)begin\{([A-Za-z*]+)\}", line)
            if env_m:
                env_name = env_m.group(1)
                end_token = f"\\end{{{env_name}}}"
                double_end = f"\\\\end{{{env_name}}}"
                if end_token in line or double_end in line:
                    flush()
                    blocks.append(Block("paragraph", f"$$\n{st}\n$$"))
                    i += 1
                    continue
                else:
                    flush()
                    env_lines = [line]
                    j = i + 1
                    found_end = False
                    while j < len(lines):
                        env_lines.append(lines[j])
                        if end_token in lines[j] or double_end in lines[j]:
                            found_end = True
                            j += 1
                            break
                        j += 1
                    if found_end:
                        content_str = "\n".join(env_lines).strip()
                        blocks.append(Block("paragraph", f"$$\n{content_str}\n$$"))
                        i = j
                        continue

            if not line.strip():
                flush()
                i += 1
                continue

            paragraph.append(line)
            i += 1

        flush()
        return blocks

    @classmethod
    def parse(cls, text):
        return {
            "language": cls.detect_language(text),
            "blocks": cls.parse_blocks(text),
        }


class WordGenerator:
    PRIMARY_FONT = "B Nazanin"
    FALLBACK_PERSIAN_FONT = "Tahoma"
    SECONDARY_FONT = "Calibri"
    CODE_FONT = "Consolas"
    MATH_FONT = "Cambria Math"

    def __init__(self, xsl_path=None, *, strict_math=False):
        self.doc = None
        self.strict_math = strict_math
        self.math = OMMLConverter(xsl_path)

    def _setup_default_styles(self, rtl=True):
        """
        Sets document default styles and font to standard Persian ('B Nazanin' or 'Tahoma')
        so that all text in the Word document is readable and rendered cleanly by default.
        """
        try:
            normal = self.doc.styles["Normal"]
            normal.font.name = self.PRIMARY_FONT
            normal.font.size = Pt(12)
            rpr = normal.element.get_or_add_rPr()
            rfonts = rpr.find(qn("w:rFonts"))
            if rfonts is None:
                rfonts = OxmlElement("w:rFonts")
                rpr.insert(0, rfonts)
            rfonts.set(qn("w:ascii"), self.FALLBACK_PERSIAN_FONT)
            rfonts.set(qn("w:hAnsi"), self.FALLBACK_PERSIAN_FONT)
            rfonts.set(qn("w:cs"), self.PRIMARY_FONT)
            rfonts.set(qn("w:eastAsia"), self.PRIMARY_FONT)

            # Complex script font size (12pt = 24 half-points)
            sz_cs = rpr.find(qn("w:szCs"))
            if sz_cs is None:
                sz_cs = OxmlElement("w:szCs")
                rpr.append(sz_cs)
            sz_cs.set(qn("w:val"), "24")

            if rtl:
                ppr = normal.element.get_or_add_pPr()
                bidi = ppr.find(qn("w:bidi"))
                if bidi is None:
                    bidi = OxmlElement("w:bidi")
                    ppr.append(bidi)
                bidi.set(qn("w:val"), "1")
                jc = ppr.find(qn("w:jc"))
                if jc is None:
                    jc = OxmlElement("w:jc")
                    ppr.append(jc)
                jc.set(qn("w:val"), "right")
        except Exception:
            pass

    @staticmethod
    def set_rtl(p, enabled=True):
        # Enable python-docx right_to_left and direction properties paragraph-by-paragraph
        try:
            p.paragraph_format.right_to_left = bool(enabled)
        except Exception:
            pass
        try:
            setattr(p.paragraph_format, "direction", "rtl" if enabled else "ltr")
        except Exception:
            pass

        ppr = p._element.get_or_add_pPr()
        bidi = ppr.find(qn("w:bidi"))
        if bidi is None:
            bidi = OxmlElement("w:bidi")
            ppr.append(bidi)
        bidi.set(qn("w:val"), "1" if enabled else "0")

        if enabled:
            jc = ppr.find(qn("w:jc"))
            if jc is None:
                jc = OxmlElement("w:jc")
                ppr.append(jc)
            jc.set(qn("w:val"), "right")

    @staticmethod
    def set_paragraph_spacing(p):
        p.paragraph_format.space_after = Pt(7)
        p.paragraph_format.line_spacing = 1.35

    def _set_font(
        self,
        run,
        name,
        size=12,
        bold=None,
        italic=None,
        *,
        is_rtl=False,
        is_english=False,
        is_number=False,
    ):
        run.font.size = Pt(size)

        if bold is not None:
            run.bold = bold
        if italic is not None:
            run.italic = italic

        rpr = run._element.get_or_add_rPr()
        fonts = rpr.find(qn("w:rFonts"))
        if fonts is None:
            fonts = OxmlElement("w:rFonts")
            rpr.insert(0, fonts)

        if is_english or is_number:
            fonts.set(qn("w:ascii"), self.SECONDARY_FONT)
            fonts.set(qn("w:hAnsi"), self.SECONDARY_FONT)
            fonts.set(qn("w:cs"), self.SECONDARY_FONT)
        elif is_rtl or self._is_persian(name or ""):
            fonts.set(qn("w:ascii"), self.SECONDARY_FONT)
            fonts.set(qn("w:hAnsi"), self.SECONDARY_FONT)
            fonts.set(qn("w:cs"), name if name else self.PRIMARY_FONT)
        else:
            for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
                fonts.set(qn(f"w:{attr}"), name)

        # BiDi run properties
        rtl_el = rpr.find(qn("w:rtl"))
        if rtl_el is None:
            rtl_el = OxmlElement("w:rtl")
            rpr.append(rtl_el)

        # English words and English numbers inside an RTL paragraph MUST be marked as w:rtl="0"
        # and w:bidi="en-US" so Word does not convert digits to Hindi/Persian numerals
        if is_english or is_number:
            rtl_el.set(qn("w:val"), "0")
            lang_el = rpr.find(qn("w:lang"))
            if lang_el is None:
                lang_el = OxmlElement("w:lang")
                rpr.append(lang_el)
            lang_el.set(qn("w:val"), "en-US")
            lang_el.set(qn("w:bidi"), "en-US")
        elif is_rtl:
            rtl_el.set(qn("w:val"), "1")
            if rpr.find(qn("w:cs")) is None:
                rpr.append(OxmlElement("w:cs"))
            lang_el = rpr.find(qn("w:lang"))
            if lang_el is None:
                lang_el = OxmlElement("w:lang")
                rpr.append(lang_el)
            lang_el.set(qn("w:val"), "en-US")
            lang_el.set(qn("w:bidi"), "fa-IR")
        else:
            rtl_el.set(qn("w:val"), "0")

    @staticmethod
    def _is_persian(text):
        return bool(re.search(r"[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]", text))

    @classmethod
    def identify_and_format_numbers(cls, text: str):
        """
        Smart server-side function to identify English numbers inside Persian text
        and manage them so that they remain in their original English numeral format
        without altering the Persian font of surrounding text.
        """
        pattern = re.compile(
            r"(\([A-Za-z0-9\s._\-+^/*=]+\)"
            r"|[A-Za-z]+(?:[-_][A-Za-z0-9]+)*"
            r"|[0-9]+(?:\.[0-9]+)*(?:e[+-]?[0-9]+)?%?"
            r")"
        )
        tokens = []
        pos = 0
        for m in pattern.finditer(text):
            start, end = m.span()
            if start > pos:
                tokens.append(("persian", text[pos:start]))
            val = m.group(0)
            if re.fullmatch(r"[0-9]+(?:\.[0-9]+)*(?:e[+-]?[0-9]+)?%?", val):
                tokens.append(("number", val))
            else:
                tokens.append(("english", val))
            pos = end
        if pos < len(text):
            tokens.append(("persian", text[pos:]))
        return tokens

    @classmethod
    def _segment_bidi(cls, text):
        return cls.identify_and_format_numbers(text)

    def _add_text_run(
        self, p, text, *, size=12, code=False, bold=False, italic=False, rtl=False
    ):
        if not text:
            return None

        clean = "".join(
            ch for ch in text
            if ord(ch) >= 32 or ch in "\n\r\t"
        )

        if not clean:
            return None

        if code:
            run = p.add_run(clean)
            self._set_font(
                run, self.CODE_FONT, size, bold, italic,
                is_english=True, is_rtl=False,
            )
            return run

        if not rtl and not self._is_persian(clean):
            run = p.add_run(clean)
            self._set_font(
                run, self.SECONDARY_FONT, size, bold, italic,
                is_english=True, is_rtl=False,
            )
            return run

        # In RTL context: split text to preserve English words,
        # technical acronyms e.g. (ODE), and English numbers cleanly.
        sub_tokens = self._segment_bidi(clean)
        first_run = None

        for kind, val in sub_tokens:
            if not val:
                continue

            # In Persian, anchor colon or period before math/English with Unicode RLM (\u200F)
            if kind == "persian" and (val.endswith(": ") or val.endswith(":")):
                val = val[:-1] + ":\u200F" if val.endswith(":") else val[:-2] + ":\u200F "

            run = p.add_run(val)
            if first_run is None:
                first_run = run

            if kind == "number":
                # Ensure ASCII digits remain English numerals
                self._set_font(
                    run, self.SECONDARY_FONT, size, bold, italic,
                    is_number=True, is_rtl=False,
                )
            elif kind == "english":
                # Ensure Latin words and parenthesized terms e.g. (ODE) remain LTR
                self._set_font(
                    run, self.SECONDARY_FONT, size, bold, italic,
                    is_english=True, is_rtl=False,
                )
            else:
                # Persian text
                self._set_font(
                    run, self.PRIMARY_FONT, size, bold, italic,
                    is_rtl=True,
                )

        return first_run

    @staticmethod
    def _set_paragraph_shading(p, fill="F0F0F0"):
        ppr = p._element.get_or_add_pPr()
        shd = ppr.find(qn("w:shd"))
        if shd is None:
            shd = OxmlElement("w:shd")
            ppr.append(shd)
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), fill)

    @staticmethod
    def _clear_paragraph(p):
        for child in list(p._p):
            if child.tag != qn("w:pPr"):
                p._p.remove(child)

    @staticmethod
    def _bare_math_candidate(s):
        s = s.strip()
        if not s or len(s) > 500:
            return False
        if re.search(r"[\u0600-\u06FF]", s):
            return False
        if "`" in s:
            return False

        if re.search(
            r"\\(?:frac|sqrt|sum|prod|int|lim|sin|cos|tan|log|ln|"
            r"alpha|beta|gamma|delta|pi|theta|omega|infty|begin|end|"
            r"left|right|mathbf|mathrm|hat|bar|vec|cdot|times|leq|"
            r"geq|neq|approx|pm)\b",
            s,
        ):
            return True

        if re.search(r"[A-Za-z]\s*(?:[_^])\s*(?:[A-Za-z0-9{}()+\-]+)", s):
            return True

        if "=" in s and re.search(r"[0-9A-Za-z^_+\-*/=(){}\[\]]", s):
            return True

        return False

    @classmethod
    def _expand_bare(cls, text):
        tokens = MathScanner.scan(text)

        if any(t.kind != "text" for t in tokens):
            return tokens

        stripped = text.strip()

        if cls._bare_math_candidate(stripped):
            return [MathToken("inline", stripped)]

        # Common form: "Label: formula"
        if ":" in stripped:
            label, rest = stripped.split(":", 1)
            if len(label) <= 80 and cls._bare_math_candidate(rest):
                return [
                    MathToken("text", label + ": "),
                    MathToken("inline", rest.strip()),
                ]

        return tokens

    def _configure_math(self):
        settings = self.doc.settings._element
        old = settings.find(qn("m:mathPr"))
        if old is not None:
            # Document already has a valid mathPr in the correct schema sequence
            return

        math_pr = OxmlElement("m:mathPr")
        math_font = OxmlElement("m:mathFont")
        math_font.set(qn("m:val"), self.MATH_FONT)
        math_pr.append(math_font)

        # In CT_Settings schema, m:mathPr MUST appear before w:themeFontLang
        theme_font = settings.find(qn("w:themeFontLang"))
        if theme_font is not None:
            theme_font.addprevious(math_pr)
        else:
            settings.append(math_pr)

    def _new_p(self, rtl=False, *, center=False):
        p = self.doc.add_paragraph()
        self.set_paragraph_spacing(p)
        if rtl:
            self.set_rtl(p)
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        if center:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        return p

    def insert_math(self, p, source, display=False):
        if not source:
            return False
        clean_check = self.math._decode(str(source)).strip()
        if not clean_check:
            return False

        try:
            omath = self.math.convert(source)
        except MathConversionError:
            if self.strict_math:
                raise

            # Keep the original formula visible instead of losing content.
            # Clean control characters to prevent XML serialization errors.
            clean = re.sub(r"[\x00-\x1f\x7f-\x9f]", " ", str(source)).strip()
            if not clean or clean in {"$$", "$", r"\[", r"\]", r"\(", r"\)", r"\\\[", r"\\\]", r"\\(", r"\\)"}:
                return False
            r = p.add_run(f" [Math: {clean}] ")
            self._set_font(r, self.CODE_FONT, 10, italic=True)
            return False

        if display:
            omath_para = OxmlElement("m:oMathPara")
            props = OxmlElement("m:oMathParaPr")
            jc = OxmlElement("m:jc")
            jc.set(qn("m:val"), "center")
            props.append(jc)
            omath_para.append(props)
            omath_para.append(omath)
            p._element.append(omath_para)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            p._element.append(omath)

        return True

    def _add_inline_markup(self, p, text, rtl=False, size=12, heading=False):
        tokens = self._expand_bare(text)

        for token in tokens:
            if token.kind != "text":
                self.insert_math(
                    p,
                    token.value,
                    display=(token.kind == "display"),
                )
                continue

            pos = 0
            pattern = re.compile(
                r"(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|"
                r"(?<!\*)\*[^*]+\*(?!\*))"
            )

            for match in pattern.finditer(token.value):
                if match.start() > pos:
                    self._add_text_run(
                        p,
                        token.value[pos:match.start()],
                        size=size,
                        bold=heading,
                        rtl=rtl,
                    )

                part = match.group(0)

                if part.startswith("`"):
                    self._add_text_run(
                        p,
                        part[1:-1],
                        size=size,
                        code=True,
                        bold=heading,
                        rtl=rtl,
                    )
                elif part.startswith("**") or part.startswith("__"):
                    self._add_text_run(
                        p,
                        part[2:-2],
                        size=size,
                        bold=True,
                        rtl=rtl,
                    )
                else:
                    self._add_text_run(
                        p,
                        part[1:-1],
                        size=size,
                        italic=True,
                        bold=heading,
                        rtl=rtl,
                    )

                pos = match.end()

            if pos < len(token.value):
                self._add_text_run(
                    p,
                    token.value[pos:],
                    size=size,
                    bold=heading,
                    rtl=rtl,
                )

    def _add_array_as_table(self, source, rtl=False):
        """
        Preserve LaTeX array environments that use & and \hline as a
        real Word table, converting formulas inside cells to native OMML.
        """
        cleaned = source.strip()
        # Strip wrapping math delimiters if the array is wrapped in $$...$$ or \[...\]
        for left, right in [("$$", "$$"), (r"\[", r"\]"), ("$", "$")]:
            if cleaned.startswith(left) and cleaned.endswith(right):
                cleaned = cleaned[len(left):-len(right)].strip()

        match = re.search(
            r"\\begin\{array\}\s*(?:\{([^}]*)\})?(.*?)\\end\{array\}",
            cleaned,
            flags=re.S,
        )
        if not match:
            return False

        body = match.group(2)
        body = re.sub(r"\\hline", "", body)

        raw_rows = re.split(r"\\\\(?:\s*\[[^]]+\])?", body)
        rows = []

        for raw in raw_rows:
            raw = raw.strip()
            if not raw:
                continue
            cells = [c.strip() for c in raw.split("&")]
            rows.append(cells)

        if not rows:
            return False

        cols = max(len(r) for r in rows)
        table = self.doc.add_table(rows=len(rows), cols=cols)
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        if rtl:
            tblPr = table._element.xpath("w:tblPr")
            if tblPr:
                bidi = OxmlElement("w:bidiVisual")
                bidi.set(qn("w:val"), "1")
                tblPr[0].append(bidi)

        for ri, row in enumerate(rows):
            for ci in range(cols):
                cell = table.cell(ri, ci)
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                p = cell.paragraphs[0]
                self._clear_paragraph(p)
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                if rtl:
                    self.set_rtl(p)
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

                value = (row[ci] if ci < len(row) else "").strip()
                if not value:
                    continue

                # Strip outer math delimiters if present inside cell
                for l, r in [("$$", "$$"), (r"\[", r"\]"), ("$", "$"), (r"\(", r"\)")]:
                    if value.startswith(l) and value.endswith(r) and len(value) > len(l) + len(r):
                        value = value[len(l):-len(r)].strip()

                # If the cell looks like math or contains LaTeX commands/symbols, convert directly
                math_done = False
                if re.search(r"\\[A-Za-z]+|[\^_=+\-*/]", value):
                    math_done = self.insert_math(p, value, display=False)

                if not math_done:
                    tokens = MathScanner.scan(value)
                    if len(tokens) == 1 and tokens[0].kind == "text":
                        self._add_inline_markup(p, value, rtl=rtl, size=10)
                    else:
                        for token in tokens:
                            if token.kind == "text":
                                self._add_inline_markup(p, token.value, rtl=rtl, size=10)
                            else:
                                self.insert_math(p, token.value, display=False)

        return True

    def add_list_item(self, text, rtl=False, marker="•"):
        p = self._new_p(rtl)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.3

        bullet_run = p.add_run(f"{marker}  ")
        self._set_font(
            bullet_run,
            self.PRIMARY_FONT if rtl else self.SECONDARY_FONT,
            size=11.5,
            bold=True,
            is_rtl=rtl,
        )
        self._add_inline_markup(p, text, rtl=rtl, size=11.5)
        return p

    def add_numbered_item(self, text, num_str, rtl=False):
        p = self._new_p(rtl)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.3

        num_run = p.add_run(f"{num_str}.  ")
        is_ascii_num = bool(re.fullmatch(r"[0-9]+", num_str))
        self._set_font(
            num_run,
            self.SECONDARY_FONT if is_ascii_num else self.PRIMARY_FONT,
            size=11.5,
            bold=True,
            is_rtl=not is_ascii_num and rtl,
            is_number=is_ascii_num,
        )
        self._add_inline_markup(p, text, rtl=rtl, size=11.5)
        return p

    def add_paragraph_content(self, text, rtl=False):
        stripped = text.strip()
        if not stripped:
            return

        # A complete LaTeX array with borders is represented as a real Word table
        if r"\begin{array}" in stripped or r"\\begin{array}" in stripped:
            if self._add_array_as_table(stripped, rtl=rtl):
                return

        # Multi-line LaTeX environment (matrix, cases, aligned, etc.)
        if re.search(r"^(?:\\\\|\\)begin\{([A-Za-z*]+)\}", stripped) and re.search(r"(?:\\\\|\\)end\{([A-Za-z*]+)\}\s*$", stripped):
            p = self._new_p(False, center=True)
            if self.insert_math(p, stripped, display=True):
                return p

        # Whole block display math ($$...$$, \[...\], or \\[...\\])
        if (
            (stripped.startswith("$$") and stripped.endswith("$$"))
            or (stripped.startswith(r"\[") and stripped.endswith(r"\]"))
            or (stripped.startswith(r"\\\[") and stripped.endswith(r"\\\]"))
        ):
            p = self._new_p(False, center=True)
            self.insert_math(p, stripped, display=True)
            return p

        # Check if block has display math spanning multiple lines
        tokens = MathScanner.scan(text)
        has_display = any(t.kind == "display" for t in tokens)

        if has_display:
            for token in tokens:
                if token.kind == "display":
                    if token.value.strip():
                        p = self._new_p(False, center=True)
                        self.insert_math(p, token.value, display=True)
                elif token.kind == "inline":
                    p = self._new_p(rtl)
                    self.insert_math(p, token.value, display=False)
                else:
                    sub_text = token.value.strip()
                    if sub_text:
                        self.add_paragraph_content(sub_text, rtl=rtl)
            return

        lines = text.split("\n")

        for line_text in lines:
            line_str = line_text.strip()
            if not line_str:
                continue

            bullet_m = re.match(r"^([*\-•])\s+(.+)$", line_str)
            if bullet_m:
                self.add_list_item(bullet_m.group(2).strip(), rtl=rtl, marker="•")
                continue

            num_m = re.match(r"^([0-9]+|[\u06F0-\u06F9]+)[.)\-]\s+(.+)$", line_str)
            if num_m:
                self.add_numbered_item(num_m.group(2).strip(), num_m.group(1), rtl=rtl)
                continue

            line_tokens = MathScanner.scan(line_text)
            if not line_tokens:
                continue

            # A line containing only display math.
            if len(line_tokens) == 1 and line_tokens[0].kind == "display":
                p = self._new_p(False, center=True)
                self.insert_math(p, line_tokens[0].value, display=True)
                continue

            p = self._new_p(rtl)

            for token in line_tokens:
                if token.kind == "display":
                    p = self._new_p(False, center=True)
                    self.insert_math(p, token.value, display=True)
                    p = self._new_p(rtl)

                elif token.kind == "inline":
                    self.insert_math(p, token.value, display=False)

                else:
                    self._add_inline_markup(p, token.value, rtl=rtl)

    def add_heading(self, text, level, rtl):
        p = self.doc.add_heading(level=min(level, 6))
        p.alignment = (
            WD_ALIGN_PARAGRAPH.CENTER
            if level == 1
            else WD_ALIGN_PARAGRAPH.RIGHT
            if rtl
            else WD_ALIGN_PARAGRAPH.LEFT
        )

        if rtl:
            self.set_rtl(p)

        # Remove the default empty run created by doc.add_heading
        for child in list(p._p):
            if child.tag != qn("w:pPr"):
                p._p.remove(child)

        size = 18 if level == 1 else max(12, 17 - level)
        self._add_inline_markup(p, str(text), rtl=rtl, size=size, heading=True)
        return p

    def add_code(self, content, rtl=False):
        p = self._new_p(False)
        p.paragraph_format.left_indent = Pt(12)
        p.paragraph_format.right_indent = Pt(12)
        self._set_paragraph_shading(p)
        self._add_text_run(p, content, size=10, code=True)
        return p

    def add_table(self, rows, rtl=False):
        if not rows:
            return None

        rows = [r for r in rows if not TextParser._is_separator(r)]
        if not rows:
            return None

        cols = max(len(r) for r in rows)
        table = self.doc.add_table(rows=len(rows), cols=cols)
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER

        if rtl:
            tblPr = table._element.xpath("w:tblPr")
            if tblPr:
                bidi = OxmlElement("w:bidiVisual")
                bidi.set(qn("w:val"), "1")
                tblPr[0].append(bidi)

        for ri, row in enumerate(rows):
            for ci in range(cols):
                cell = table.cell(ri, ci)
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

                p = cell.paragraphs[0]
                self._clear_paragraph(p)
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER

                if rtl:
                    self.set_rtl(p)
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

                value = row[ci] if ci < len(row) else ""
                tokens = MathScanner.scan(value)

                if len(tokens) == 1 and tokens[0].kind == "text":
                    self._add_inline_markup(p, value, rtl=rtl, size=10)
                else:
                    for token in tokens:
                        if token.kind == "text":
                            self._add_inline_markup(
                                p, token.value, rtl=rtl, size=10
                            )
                        else:
                            self.insert_math(
                                p, token.value,
                                display=(token.kind == "display"),
                            )

                if ri == 0:
                    for run in p.runs:
                        run.bold = True

        return table

    @staticmethod
    def _safe_filename(name):
        value = Path(name or "").name
        value = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", value)

        if not value:
            value = "generated_word.docx"

        if not value.lower().endswith(".docx"):
            value += ".docx"

        return value

    def generate(self, parsed, filename=None, output_dir=None):
        self.doc = Document()
        rtl = parsed.get("language") == "persian"
        self._setup_default_styles(rtl=rtl)
        self._configure_math()

        for block in parsed.get("blocks", []):
            if block.kind == "heading":
                self.add_heading(str(block.value), block.level, rtl)

            elif block.kind == "list_item":
                self.add_list_item(
                    str(block.value),
                    rtl=rtl,
                    marker=getattr(block, "level", "•") or "•",
                )

            elif block.kind == "numbered_item":
                self.add_numbered_item(
                    str(block.value),
                    str(getattr(block, "level", "1") or "1"),
                    rtl=rtl,
                )

            elif block.kind == "paragraph":
                self.add_paragraph_content(str(block.value), rtl)

            elif block.kind == "code":
                self.add_code(block.value[0], rtl)

            elif block.kind == "table":
                self.add_table(block.value, rtl)

        if filename is None:
            filename = f"generated_word_{datetime.now():%Y%m%d_%H%M%S}.docx"

        filename = self._safe_filename(filename)

        out = Path(
            output_dir
            or Path(__file__).resolve().parent / "output"
        )
        out.mkdir(parents=True, exist_ok=True)

        path = out / filename
        self.doc.save(path)
        self.validate_docx(path)

        return {
            "success": True,
            "filename": filename,
            "filepath": str(path),
            "message": f"Word document generated: {filename}",
        }

    @staticmethod
    def validate_docx(path):
        with zipfile.ZipFile(path) as z:
            if z.testzip() is not None:
                raise MathConversionError("DOCX archive is corrupted")

            xml = z.read("word/document.xml")

        root = etree.fromstring(
            xml,
            etree.XMLParser(
                resolve_entities=False,
                no_network=True,
                recover=False,
            ),
        )

        if root.xpath(
            "//m:oMath//m:oMath",
            namespaces=NS,
        ):
            raise MathConversionError("Nested oMath detected")


RAW_MATH_CMDS = re.compile(
    r"\\(?:frac|sqrt|sum|prod|int|iint|iiint|oint|lim|sin|cos|tan|cot|sec|csc|"
    r"sinh|cosh|tanh|arcsin|arccos|arctan|log|ln|Ln|exp|det|"
    r"alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|"
    r"Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|"
    r"infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|implies|"
    r"cdot|times|pm|mp|div|ast|star|circ|bullet|"
    r"leq|geq|le|ge|neq|approx|equiv|sim|simeq|propto|"
    r"subset|supset|subseteq|supseteq|in|notin|ni|forall|exists|"
    r"cup|cap|setminus|emptyset|varnothing|"
    r"left|right|text|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|"
    r"hat|bar|vec|tilde|dot|ddot|overline|underline|quad|qquad)"
)

def looks_like_raw_math(s: str) -> bool:
    s = s.strip()
    if not s or len(s) < 2:
        return False
    if re.search(r"[\u0600-\u06FF]", s):
        return False
    if re.match(r"^\[?SOURCE_IMAGE_\d+\]?$", s) or (re.match(r"^\[?[A-Za-z0-9_]+\]?$", s) and "_" in s and "\\" not in s and "^" not in s):
        return False
    if re.match(r"^[\d\s.,:;()\[\]\-]+$", s):
        return False
    if RAW_MATH_CMDS.search(s):
        return True
    if re.search(r"\\begin\{", s):
        return True
    if re.search(r"[A-Za-z0-9)\]}]\s*[\^_]\s*(?:[A-Za-z0-9]|\{[^}]+\})", s):
        return True
    if re.search(r"[A-Za-z0-9)\]}]\s*(?:=|\\approx|\\neq|\\le|\\ge|\\to|\\implies|<|>)\s*[A-Za-z0-9(\[{\\]", s):
        return True
    if re.search(r"\([^)]+\)\s*'\s*=", s) or re.search(r"'\s*=", s):
        return True
    # Derivative expressions: f'(a), f'(x), f''(c), g'(t), y', u', etc.
    if re.search(r"\b[fghuvwy]\s*'{1,3}(?:\([a-zA-Z0-9, ]+\))?", s):
        return True
    # Coordinates / point evaluation: (a, f(a)), (x_0, y_0)
    if re.search(r"\([a-zA-Z0-9_]+,\s*[a-zA-Z0-9_()']+\)", s):
        return True
    if re.search(r"\b(?:Ln|ln|log|exp|sin|cos|tan)\b\s*[A-Za-z0-9(]", s):
        return True
    if re.search(r"\b[A-Za-z]\s*(?:\+|\-|\*|\/|\\cdot)\s*[A-Za-z0-9]", s) and ("=" in s or "^" in s or "\\" in s):
        return True
    return False

def clean_raw_math(s: str) -> str:
    s = s.strip()
    s = re.sub(r"(?<!\\)\bLn\b", r"\\ln", s)
    return s

def balance_raw_parens(lead: str, core: str, trail: str):
    while core.count('(') < core.count(')') and lead.endswith('('):
        lead = lead[:-1]
        core = '(' + core
    while core.count(')') < core.count('(') and trail.startswith(')'):
        trail = trail[1:]
        core = core + ')'
    if core.startswith('(') and core.endswith(')'):
        inner = core[1:-1].strip()
        depth = 0
        balanced = True
        for ch in inner:
            if ch == '(': depth += 1
            elif ch == ')':
                depth -= 1
                if depth < 0:
                    balanced = False
                    break
        if balanced and depth == 0:
            lead = lead + '('
            trail = ')' + trail
            core = inner
    return lead, core, trail

def normalize_text_with_math(text: str) -> str:
    # Fix trailing \\) or \\( after Persian text: e.g. "برای توابع \\)" -> "برای توابع:"
    text = re.sub(r"([\u0600-\u06FF])\s*\\+[\(\)]", r"\1:", text)

    # Match broken cases/parametric systems e.g.:
    # {
    # x = g(t)
    # y = f(t)
    # :)\
    cases_pattern = re.compile(
        r"^[ \t]*\{[ \t]*\n([\s\S]+?)\n[ \t]*(?::\s*\)+[\\/]*|:\s*\\+|\}|:\s*\)\s*\\*)",
        re.MULTILINE
    )
    def repl_cases(m):
        raw_lines = m.group(1).splitlines()
        clean_lines = []
        for line in raw_lines:
            line_s = line.strip().rstrip("\\").strip().strip("$").strip()
            if line_s:
                clean_lines.append(line_s)
        body = " \\\\ \n".join(clean_lines)
        return f"\n$$\n\\begin{{cases}}\n{body}\n\\end{{cases}}\n$$\n"

    text = cases_pattern.sub(repl_cases, text)

    lines = text.splitlines()
    out_lines = []
    
    in_code = False
    in_env = False
    in_dollar_math = False
    already_wrapped = False
    env_buf = []
    
    for line in lines:
        stripped = line.strip()

        # Discard stray backslash lines: \ or \\ or \ 
        if re.match(r"^\\+\s*$", stripped):
            continue
        
        # Code fence
        if stripped.startswith("```"):
            in_code = not in_code
            out_lines.append(line)
            continue
        if in_code:
            out_lines.append(line)
            continue
            
        # Standalone LaTeX environment like \begin{array} ... \end{array}
        if re.match(r"^\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|cases|align\*?|equation\*?)\}", stripped):
            in_env = True
            already_wrapped = in_dollar_math or (len(out_lines) > 0 and out_lines[-1].strip() == "$$")
            env_buf = [line]
            continue
        if in_env:
            env_buf.append(line)
            if re.search(r"\\end\{(array|matrix|pmatrix|bmatrix|vmatrix|cases|align\*?|equation\*?)\}", stripped):
                in_env = False
                if already_wrapped:
                    out_lines.extend(env_buf)
                else:
                    out_lines.append("$$")
                    out_lines.extend(env_buf)
                    out_lines.append("$$")
                env_buf = []
            continue

        # Single-line display math starting with \[ or \ [ or \\\[ or $$
        is_single_display = False
        for op in (r"$$", r"\ [", r"\[", r"\\ [", r"\\\["):
            if stripped.startswith(op):
                for cl in (r"$$", r"\cr]", r"\cr ]", r"\\cr]", r"\\cr ]", r"\]", r"\\\]"):
                    if stripped.endswith(cl) and len(stripped) >= len(op) + len(cl):
                        clean_core = OMMLConverter._decode(stripped)
                        if clean_core:
                            out_lines.append(f"$$\n{clean_core}\n$$")
                            is_single_display = True
                            break
                if is_single_display:
                    break
        if is_single_display:
            continue

        # Check if line toggles display math block ($$, \[, \ [, or \\\[)
        if stripped in (r"\[", r"\\\[", r"\ ["):
            in_dollar_math = True
            out_lines.append("$$")
            continue
        if stripped in (r"\]", r"\\\]", r"\cr]", r"\cr ]", r"\\cr]"):
            in_dollar_math = False
            out_lines.append("$$")
            continue

        if stripped.startswith("$$") and stripped.count("$$") % 2 == 1:
            in_dollar_math = not in_dollar_math
            out_lines.append(line)
            continue

        if in_dollar_math:
            out_lines.append(line)
            continue
            
        # Process inline line
        delim_pattern = re.compile(
            r"(\$\$[^\$]+\$\$|\$[^\$]+\$|"
            r"(?:\\ ?\[|\\\\\[)[\s\S]+?(?:\\ ?\]|\\\\\]|\\\\?cr\s*\])|"
            r"(?:\\ ?\(|\\\\\\()[\s\S]+?(?:\\ ?\)|\\\\\\)))"
        )
        parts = delim_pattern.split(line)
        line_out = []
        
        for idx, part in enumerate(parts):
            if not part:
                continue
            if idx % 2 == 1:
                clean_part = OMMLConverter._decode(part)
                line_out.append(f"${clean_part}$")
                continue
                
            segments = re.split(r"([\u0600-\u06FF\u060C\u061B]+)", part)
            for seg in segments:
                if re.search(r"[\u0600-\u06FF\u060C\u061B]", seg):
                    line_out.append(seg)
                    continue
                    
                m_lead = re.match(r"^([\s:.\-*|()]+)", seg)
                lead = m_lead.group(1) if m_lead else ""
                rest = seg[len(lead):]
                
                m_trail = re.search(r"([\s:.\-*|()]+)$", rest)
                trail = m_trail.group(1) if m_trail else ""
                core = rest[:-len(trail)] if trail else rest
                
                lead, core, trail = balance_raw_parens(lead, core, trail)
                
                if looks_like_raw_math(core):
                    line_out.append(lead)
                    line_out.append(f"${clean_raw_math(core)}$")
                    line_out.append(trail)
                else:
                    line_out.append(seg)
                    
        out_lines.append("".join(line_out))
        
    return "\n".join(out_lines)


def generate_word_from_text(
    text,
    filename=None,
    *,
    output_dir=None,
    xsl_path=None,
    strict_math=False,
):
    normalized = normalize_text_with_math(text)
    parsed = TextParser.parse(normalized)
    generator = WordGenerator(
        xsl_path=xsl_path,
        strict_math=strict_math,
    )
    return generator.generate(
        parsed,
        filename=filename,
        output_dir=output_dir,
    )
