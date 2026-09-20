import re

MATH_COMMANDS = (
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

def is_math_candidate(span: str) -> bool:
    s = span.strip()
    if not s or len(s) < 2:
        return False
    if re.search(r"[\u0600-\u06FF]", s):
        return False
    has_cmd = bool(re.search(MATH_COMMANDS, s))
    has_subsup = bool(re.search(r"[A-Za-z0-9)\]}]\s*[\^_]\s*([A-Za-z0-9]|\{[^}]+\})", s))
    has_eq = bool(re.search(r"[A-Za-z0-9)\]}]\s*(?:=|\\approx|\\neq|\\le|\\ge|\\to|\\implies|<|>)\s*[A-Za-z0-9(\[{\\]", s))
    has_func_prime = bool(re.search(r"\([^)]+\)\s*'", s))
    has_math_ops = bool(re.search(r"\b(?:Ln|ln|log|exp|sin|cos|tan)\b\s*[A-Za-z0-9(]", s))
    
    return has_cmd or has_subsup or has_eq or has_func_prime or has_math_ops

tests = [
    r"\frac{a \pm b}{c} = \frac{a}{c} \pm \frac{b}{c}",
    r"a^m \cdot a^n = a^{m+n}",
    r"Ln a + Ln b = Ln(ab)",
    r"e^{-Ln u} = \frac{1}{u}",
    r"(\frac{1}{x})' = \frac{-1}{x^2}",
    "سلام بر شما",
    "SOURCE_IMAGE_1"
]

for t in tests:
    print(t[:30], "->", is_math_candidate(t))
