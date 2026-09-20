#!/usr/bin/env python3
"""
LaTeX-to-Word Converter & Math Restorer
=======================================
Fixes Word documents where LaTeX formulas were dropped or left as raw text.
Converts:
  - Display Math: $$...$$, \\[...\\], \\begin{...}...\\end{...}
  - Inline Math: $...$, \\(...\\), \\\\(...\\\\)
Into native Microsoft Office Math Markup Language (OMML) with:
  - Persian/Arabic Right-to-Left (RTL) paragraph alignment
  - Proper LTR Math run direction
  - Graceful fallback: [⚠️ LaTeX: ...] on error
  - Support for paragraphs and table cells
"""

import os
import sys
import re
import argparse
from pathlib import Path
from typing import List, Tuple, Optional

import docx
from docx import Document
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls
import latex2mathml.converter
from lxml import etree

# Namespaces
NS_MATH = "http://schemas.openxmlformats.org/officeDocument/2006/math"
NS_WORD = "http://schemas.openxmlformats.org/officeDocument/2006/main"


# ==============================================================================
# 1. الگوهای شناسایی عبارات منظم (Regex Patterns)
# ==============================================================================

# شناسایی فرمول‌هایی که با \ [ شروع و با \cr] تمام می‌شوند
display_math_custom = re.compile(r'\\ \[\s*(.+?)\s*\\cr\]', re.DOTALL)

# شناسایی فرمول‌های درون خطی
inline_math_paren = re.compile(r'\\\\\((.+?)\\\\\)')

# الگوهای تکمیلی استاندارد لاتک برای پوشش کامل
display_math_escaped = re.compile(r'\\\\\s*\[([\s\S]*?)\\\\\s*\]')
display_math_dollar = re.compile(r'\$\$([\s\S]*?)\$\$')
display_math_bracket = re.compile(r'\\\[([\s\S]*?)\\\]')
inline_math_paren_std = re.compile(r'\\\(([\s\S]*?)\\\)')
inline_math_dollar = re.compile(r'(?<!\\|\$)\$(?!\$)(.+?)(?<!\\|\$)\$')
latex_environment = re.compile(r'(\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\2\})')


# ==============================================================================
# 2. تکمیل تابع تبدیل MathML به OMML (Microsoft XSLT)
# ==============================================================================

# مسیر فایل XSL که باید در کنار اسکریپت یا پوشه منابع قرار داشته باشد
def _resolve_xsl_path() -> str:
    candidates = [
        Path("MML2OMML.XSL"),
        Path("resources/MML2OMML.XSL"),
        Path(__file__).parent / "MML2OMML.XSL",
        Path(__file__).parent / "resources" / "MML2OMML.XSL",
    ]
    if sys.platform == "win32":
        for prog_files in [os.environ.get("ProgramFiles", "C:\\Program Files"),
                           os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")]:
            for ver in ["root\\Office16", "Office16", "Office15", "Office14"]:
                candidates.append(Path(prog_files) / "Microsoft Office" / ver / "MML2OMML.XSL")
    for cand in candidates:
        if cand.exists():
            return str(cand.resolve())
    return "MML2OMML.XSL"

XSL_FILE = _resolve_xsl_path()

try:
    xslt = etree.parse(XSL_FILE)
    transform = etree.XSLT(xslt)
except Exception as e:
    xslt = None
    transform = None
    print(f"[Warning] Could not initialize XSLT transform from '{XSL_FILE}': {e}", file=sys.stderr)


def latex_to_omml(latex_code):
    try:
        clean_code = latex_code.strip()
        if not clean_code:
            return None

        # پاکسازی پسوندهای خاص مانند \cr احتمالی یا فاصله‌های ناخواسته
        if clean_code.endswith(r"\cr"):
            clean_code = clean_code[:-3].strip()
        clean_code = clean_code.replace(r"\bmatrix", r"\begin{bmatrix}").replace(r"\pmatrix", r"\begin{pmatrix}")
        clean_code = re.sub(
            r"([A-Za-z0-9])'+",
            lambda m: m.group(1) + "^{\\prime" + ("\\prime" * (len(m.group(0)) - 2)) + "}",
            clean_code
        )

        # مرحله اول: تبدیل به MathML
        mathml_str = latex2mathml.converter.convert(clean_code)
        mathml_xml = etree.fromstring(mathml_str.encode('utf-8'))

        # مرحله دوم: تبدیل MathML به OMML از طریق XSLT
        if transform is not None:
            omml_xml = transform(mathml_xml)
            omml_str = str(omml_xml)

            # پاکسازی تگ‌های اضافی برای سازگاری با python-docx
            omml_str = omml_str.replace('<?xml version="1.0"?>\n', '')
            omml_str = omml_str.replace('<?xml version="1.0"?>\r\n', '')
            omml_str = omml_str.replace('<?xml version="1.0"?>', '').strip()
            return omml_str
        else:
            raise RuntimeError(f"XSLT transform is not available (stylesheet '{XSL_FILE}' missing)")
    except Exception as e:
        print(f"Error converting formula: {e}")
        return None


def add_math_to_paragraph(paragraph, omml_str):
    # تزریق کدهای OMML به پاراگراف ورد
    omath_element = parse_xml(omml_str)
    paragraph._element.append(omath_element)


# کلاس کمکی برای سازگاری با متدهای کلاس MathConverter
class MathConverter:
    @classmethod
    def init_xslt(cls, xslt_path: Optional[str] = None):
        global XSL_FILE, xslt, transform
        if xslt_path and Path(xslt_path).exists():
            XSL_FILE = str(Path(xslt_path).resolve())
            try:
                xslt = etree.parse(XSL_FILE)
                transform = etree.XSLT(xslt)
            except Exception as ex:
                print(f"[Warning] Failed to initialize custom XSLT stylesheet ({XSL_FILE}): {ex}", file=sys.stderr)

    @classmethod
    def latex_to_omml(cls, latex_code: str, is_display: bool = False):
        return latex_to_omml(latex_code)


# ==============================================================================
# 3. Math & Text Scanner
# ==============================================================================

class MathToken:
    def __init__(self, kind: str, value: str):
        self.kind = kind  # 'text', 'inline_math', 'display_math'
        self.value = value

    def __repr__(self):
        return f"MathToken({self.kind}, {self.value!r})"


class TextMathScanner:
    """Scans and extracts all LaTeX math expressions while preserving surrounding text."""

    @classmethod
    def is_persian_or_arabic(cls, text: str) -> bool:
        """Checks if text contains Persian/Arabic characters."""
        return bool(re.search(r"[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]", text))

    @classmethod
    def cleanup_text(cls, text: str) -> str:
        """Removes stray backslashes, fixes punctuation spacing and double spaces."""
        if not text:
            return ""
        text = re.sub(r"[ \t]+", " ", text)
        return text

    @classmethod
    def scan_paragraph_text(cls, text: str) -> List[MathToken]:
        """Splits a paragraph string into alternating text and math tokens."""
        tokens: List[MathToken] = []
        if not text:
            return tokens

        last_end = 0

        # ترتیب اولویت اسکن الگوها (الگوی سفارشی و پرانتزی در صدر)
        master_regex = re.compile(
            r"\\ \[\s*([\s\S]*?)\s*\\cr\]|"                           # group 1: \ [ ... \cr]
            r"\\\\\s*\(([\s\S]*?)\\\\\s*\)|"                         # group 2: \\( ... \\)
            r"\\\\\s*\[([\s\S]*?)\\\\\s*\]|"                         # group 3: \\[ ... \\]
            r"\$\$([\s\S]*?)\$\$|"                                   # group 4: $$ ... $$
            r"\\\[([\s\S]*?)\\\]|"                                   # group 5: \[ ... \]
            r"(\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\7\})|"         # group 6: \begin{...}...\end{...}
            r"\\\(([\s\S]*?)\\\)|"                                   # group 8: \( ... \)
            r"(?<!\\|\$)\$(?!\$)(.+?)(?<!\\|\$)\$"                  # group 9: $ ... $
        )

        for match in master_regex.finditer(text):
            start, end = match.span()
            if start > last_end:
                plain = text[last_end:start]
                if plain:
                    tokens.append(MathToken("text", plain))

            # Determine match kind and extracted formula
            if match.group(1) is not None:
                tokens.append(MathToken("display_math", match.group(1)))
            elif match.group(2) is not None:
                tokens.append(MathToken("inline_math", match.group(2)))
            elif match.group(3) is not None:
                tokens.append(MathToken("display_math", match.group(3)))
            elif match.group(4) is not None:
                tokens.append(MathToken("display_math", match.group(4)))
            elif match.group(5) is not None:
                tokens.append(MathToken("display_math", match.group(5)))
            elif match.group(6) is not None:
                tokens.append(MathToken("display_math", match.group(6)))
            elif match.group(8) is not None:
                tokens.append(MathToken("inline_math", match.group(8)))
            elif match.group(9) is not None:
                tokens.append(MathToken("inline_math", match.group(9)))

            last_end = end

        if last_end < len(text):
            remainder = text[last_end:]
            if remainder:
                tokens.append(MathToken("text", remainder))

        return tokens


# ==============================================================================
# 3. Document Processing & Formatting
# ==============================================================================

class DocumentMathFixer:
    """Processes Word documents, converting all LaTeX tokens into OMML math."""

    def __init__(self, xslt_path: Optional[str] = None):
        MathConverter.init_xslt(xslt_path)

    @staticmethod
    def set_paragraph_direction(paragraph, rtl: bool):
        """Sets paragraph reading order to RTL or LTR."""
        pPr = paragraph._element.get_or_add_pPr()
        # Remove existing bidi if any
        for b in pPr.findall(qn("w:bidi")):
            pPr.remove(b)
        if rtl:
            bidi = OxmlElement("w:bidi")
            bidi.set(qn("w:val"), "1")
            pPr.append(bidi)

    @staticmethod
    def add_text_run(paragraph, text: str, rtl: bool = False, font_name: str = "B Nazanin"):
        """Adds a styled text run with correct bidi properties."""
        run = paragraph.add_run(text)
        run.font.name = font_name
        rPr = run._element.get_or_add_rPr()
        if rtl:
            rPr.set(qn("w:rtl"), "1")
            rFonts = rPr.get_or_add_rFonts()
            rFonts.set(qn("w:cs"), font_name)
        return run

    def process_paragraph(self, paragraph) -> bool:
        """
        Scans paragraph for LaTeX math expressions.
        Rebuilds the paragraph with OMML elements if math is found.
        Returns True if math was processed, False otherwise.
        """
        full_text = paragraph.text
        if not full_text:
            return False

        is_rtl = TextMathScanner.is_persian_or_arabic(full_text)
        if is_rtl:
            self.set_paragraph_direction(paragraph, rtl=True)

        if not any(delim in full_text for delim in ["$", r"\(", r"\[", r"\ [", r"\begin", r"\\(", r"\\\[", r"\cr]"]):
            return False

        tokens = TextMathScanner.scan_paragraph_text(full_text)
        has_math = any(t.kind in ("inline_math", "display_math") for t in tokens)
        if not has_math:
            return False

        # Clear existing text runs in paragraph before replacing with parsed tokens
        p_element = paragraph._element
        for r in list(paragraph.runs):
            p_element.remove(r._element)

        for token in tokens:
            if token.kind == "text":
                cleaned = TextMathScanner.cleanup_text(token.value)
                if cleaned:
                    self.add_text_run(paragraph, cleaned, rtl=is_rtl)
            elif token.kind in ("inline_math", "display_math"):
                try:
                    omml_str = latex_to_omml(token.value)
                    if omml_str is not None:
                        # Append OMML directly to paragraph via add_math_to_paragraph
                        add_math_to_paragraph(paragraph, omml_str)
                    else:
                        raise ValueError("OMML element conversion returned None")
                except Exception as err:
                    # Fallback representation as requested: [⚠️ LaTeX: ...]
                    fallback_text = f" [⚠️ LaTeX: {token.value.strip()}] "
                    fallback_run = paragraph.add_run(fallback_text)
                    fallback_run.font.bold = True
                    print(f"Warning: Fallback applied for formula: {token.value.strip()} ({err})", file=sys.stderr)

        return True

    def fix_document(self, input_path: str, output_path: str) -> dict:
        """Processes an entire .docx file (paragraphs and table cells)."""
        doc = Document(input_path)
        math_count = 0

        # 1. Process body paragraphs
        for p in doc.paragraphs:
            if self.process_paragraph(p):
                math_count += 1

        # 2. Process tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        if self.process_paragraph(p):
                            math_count += 1

        doc.save(output_path)
        return {
            "success": True,
            "input_file": input_path,
            "output_file": output_path,
            "math_paragraphs_converted": math_count
        }

    def convert_text_to_docx(self, text: str, output_path: str) -> dict:
        """Creates a brand new Word document from raw text containing LaTeX."""
        doc = Document()
        lines = text.split("\n")
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            
            p = doc.add_paragraph()
            # Check for headings
            if stripped.startswith("# "):
                self.add_text_run(p, stripped[2:], rtl=TextMathScanner.is_persian_or_arabic(stripped))
                p.style = 'Heading 1'
            elif stripped.startswith("## "):
                self.add_text_run(p, stripped[3:], rtl=TextMathScanner.is_persian_or_arabic(stripped))
                p.style = 'Heading 2'
            elif stripped.startswith("### "):
                self.add_text_run(p, stripped[4:], rtl=TextMathScanner.is_persian_or_arabic(stripped))
                p.style = 'Heading 3'
            else:
                p.text = stripped
                self.process_paragraph(p)

        doc.save(output_path)
        return {
            "success": True,
            "output_file": output_path
        }


# ==============================================================================
# 4. Command Line Interface (CLI)
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Fix broken Word documents or convert LaTeX text to native OMML Word (.docx)"
    )
    parser.add_argument("input", help="Path to input .docx or .txt file")
    parser.add_argument("-o", "--output", help="Path to output .docx file", default="fixed_output.docx")
    parser.add_argument("--xslt", help="Path to Microsoft MML2OMML.XSL stylesheet", default=None)
    parser.add_argument("--text-mode", action="store_true", help="Treat input file as plain text/markdown")

    args = parser.parse_args()

    input_file = Path(args.input)
    if not input_file.exists():
        print(f"Error: Input file '{args.input}' not found.", file=sys.stderr)
        sys.exit(1)

    fixer = DocumentMathFixer(xslt_path=args.xslt)

    if args.text_mode or input_file.suffix.lower() in [".txt", ".md"]:
        with open(input_file, "r", encoding="utf-8") as f:
            content = f.read()
        print(f"Converting text file '{args.input}' to '{args.output}'...")
        res = fixer.convert_text_to_docx(content, args.output)
    else:
        print(f"Repairing Word document '{args.input}' -> '{args.output}'...")
        res = fixer.fix_document(args.input, args.output)

    print(f"✅ Conversion complete! Output saved to: {res['output_file']}")


if __name__ == "__main__":
    main()
