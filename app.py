from flask import Flask, request, jsonify, send_file, render_template_string
from pathlib import Path
import os
import re
import traceback

from engine import generate_word_from_text, MathConversionError, TextParser, OMMLConverter

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FOLDER = BASE_DIR / "output"
OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)


def convert_computational_to_latex(code: str) -> str:
    """
    Transforms computational math expressions (Python, Sympy, Word Linear UnicodeMath, etc.)
    into standard, accurate LaTeX notation.
    """
    lines = code.split("\n")
    converted_lines = []

    for line in lines:
        stripped = line.strip()
        # If line is already LaTeX display or fenced code or markdown heading, keep it
        if stripped.startswith("$$") or stripped.startswith("```") or stripped.startswith("#"):
            converted_lines.append(line)
            continue

        # Common computational function replacements
        s = line

        # Power ** -> ^
        s = re.sub(r"\*\*([0-9a-zA-Z_]+|\([^)]+\))", r"^{\1}", s)
        s = re.sub(r"\^\{([0-9a-zA-Z_]+)\}", r"^{\1}", s)

        # Multiplications like 4 * x or 4*x -> 4 \cdot x
        s = re.sub(r"(\d+)\s*\*\s*([a-zA-Z])", r"\1 \\cdot \2", s)
        s = re.sub(r"([a-zA-Z0-9])\s*\*\s*([a-zA-Z0-9])", r"\1 \\cdot \2", s)

        # Square root sqrt(...) -> \sqrt{...}
        s = re.sub(r"\bsqrt\(([^()]+)\)", r"\\sqrt{\1}", s)
        # Nested or general sqrt
        for _ in range(3):
            s = re.sub(r"\bsqrt\(([^()]+)\)", r"\\sqrt{\1}", s)

        # Fractions: (num)/(den) -> \frac{num}{den}
        s = re.sub(r"\(([^\/()]+)\)\s*\/\s*\(([^\/()]+)\)", r"\\frac{\1}{\2}", s)
        s = re.sub(r"(\b[a-zA-Z0-9_]+)\s*\/\s*(\b[a-zA-Z0-9_]+)", r"\\frac{\1}{\2}", s)

        # Common Greek letters when written as plain words in code
        greek = {
            "alpha": r"\alpha", "beta": r"\beta", "gamma": r"\gamma", "delta": r"\delta",
            "epsilon": r"\epsilon", "zeta": r"\zeta", "eta": r"\eta", "theta": r"\theta",
            "iota": r"\iota", "kappa": r"\kappa", "lambda": r"\lambda", "mu": r"\mu",
            "nu": r"\nu", "xi": r"\xi", "pi": r"\pi", "rho": r"\rho", "sigma": r"\sigma",
            "tau": r"\tau", "phi": r"\phi", "chi": r"\chi", "psi": r"\psi", "omega": r"\omega",
            "Delta": r"\Delta", "Gamma": r"\Gamma", "Theta": r"\Theta", "Lambda": r"\Lambda",
            "Sigma": r"\Sigma", "Phi": r"\Phi", "Psi": r"\Psi", "Omega": r"\Omega"
        }
        for name, sym in greek.items():
            s = re.sub(rf"(?<!\\)\b{name}\b", lambda _m, r=sym: r, s)

        # Common math functions
        for fn in ["sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh", "exp", "log", "ln", "lim"]:
            s = re.sub(rf"(?<!\\)\b{fn}\b", lambda _m, f=fn: f"\\{f}", s)

        # Integrals / derivatives common forms:
        # int(f, x) -> \int f \, dx
        # diff(y, x) -> \frac{dy}{dx}
        s = re.sub(r"\bdiff\(([a-zA-Z]),\s*([a-zA-Z])\)", r"\\frac{d\1}{d\2}", s)
        s = re.sub(r"\bint\(([^,]+),\s*([a-zA-Z])\)", r"\\int \1 \\, d\2", s)

        # Summation sum(expr, i, 1, n) -> \sum_{i=1}^{n} expr
        s = re.sub(r"\bsum\(([^,]+),\s*([a-zA-Z]),\s*([0-9a-zA-Z]+),\s*([0-9a-zA-Z]+)\)", r"\\sum_{\2=\3}^{\4} \1", s)

        # Infinity
        s = re.sub(r"\b(inf|infinity|Infinity)\b", lambda _m: r"\infty", s)

        # Approximation and comparisons: <=, >=, !=, ~=
        s = s.replace("<=", r"\le ").replace(">=", r"\ge ").replace("!=", r"\neq ").replace("~=", r"\approx ")

        converted_lines.append(s)

    return "\n".join(converted_lines)


@app.post("/convert_computational")
@app.post("/api/convert_computational")
def api_convert_computational():
    try:
        data = request.get_json(silent=True) or {}
        code = data.get("code", "")
        mode = data.get("mode", "formula")  # 'formula', 'full_text'
        
        converted = convert_computational_to_latex(code)
        return jsonify(success=True, result=converted), 200
    except Exception as exc:
        return jsonify(success=False, error=str(exc)), 500


@app.post("/generate")
@app.post("/api/generate")
def api_generate():
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify(success=False, error="درخواست JSON معتبر نیست."), 400

        text = data.get("text")
        if not isinstance(text, str) or not text.strip():
            return jsonify(success=False, error="متن ورودی خالی است."), 400

        filename = data.get("filename") or None

        result = generate_word_from_text(
            text,
            filename=filename,
            output_dir=OUTPUT_FOLDER,
            strict_math=False,
        )
        return jsonify(result), 200

    except MathConversionError as exc:
        app.logger.exception("Math conversion error")
        return jsonify(
            success=False,
            error=f"خطای تبدیل فرمول ریاضی:\n{exc}"
        ), 422

    except Exception as exc:
        app.logger.exception("Word generation failed")
        return jsonify(
            success=False,
            error=f"خطای Python هنگام ساخت Word:\n{exc}\n\n"
                   f"جزئیات:\n{traceback.format_exc()}"
        ), 500


@app.get("/download/<path:filename>")
@app.get("/api/download/<path:filename>")
def download_file(filename):
    safe = Path(filename).name
    path = OUTPUT_FOLDER / safe

    if not path.is_file():
        return jsonify(success=False, error="فایل پیدا نشد."), 404

    return send_file(
        path,
        as_attachment=True,
        download_name=safe,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.get("/health")
@app.get("/api/health")
def health():
    return jsonify(status="healthy", service="word-math-omml-engine")


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5001))
    print(f"Flask Math Engine listening on port {port}")
    try:
        from waitress import serve
        serve(app, host="0.0.0.0", port=port, _quiet=True)
    except ImportError:
        import logging
        logging.getLogger("werkzeug").setLevel(logging.ERROR)
        app.run(host="0.0.0.0", port=port, debug=False)

