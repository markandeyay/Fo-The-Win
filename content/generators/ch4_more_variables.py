#!/usr/bin/env python3
"""Generator for Chapter 4: More Variables problem bank."""

import hashlib
import json
import math
import os
import random
import re

GROUP = "ch4_more_variables"
OUT_DIR = os.path.join(os.getcwd(), "content", "problems", GROUP)
COUNT = 50
DIFFICULTIES = ["easy", "medium", "hard"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_checksum(topic_id: str, difficulty: str, prompt: str, answer: str) -> str:
    payload = topic_id + difficulty + prompt + answer
    return "sha256-" + hashlib.sha256(payload.encode()).hexdigest()


def reduce_frac(num: int, den: int):
    if den == 0:
        return (num, den)
    if den < 0:
        num, den = -num, -den
    g = math.gcd(num, den)
    return (num // g, den // g)


def frac_latex(num: int, den: int) -> str:
    r = reduce_frac(num, den)
    if r[1] == 1:
        return f"${r[0]}$"
    return f"$\\dfrac{{{r[0]}}}{{{r[1]}}}$"


def frac_str(num: int, den: int) -> str:
    r = reduce_frac(num, den)
    if r[1] == 1:
        return str(r[0])
    return f"{r[0]}/{r[1]}"


def add_frac(a, b):
    return reduce_frac(a[0] * b[1] + b[0] * a[1], a[1] * b[1])


def sub_frac(a, b):
    return reduce_frac(a[0] * b[1] - b[0] * a[1], a[1] * b[1])


def mul_frac(a, b):
    return reduce_frac(a[0] * b[0], a[1] * b[1])


def div_frac(a, b):
    return reduce_frac(a[0] * b[1], a[1] * b[0])


def to_py(expr: str) -> str:
    """Convert a simple math expression to Python syntax for evaluation."""
    s = expr.replace("^", "**")
    s = re.sub(r"(\d)([a-zA-Z])", r"\1*\2", s)
    s = re.sub(r"([a-zA-Z])([a-zA-Z])", r"\1*\2", s)
    s = re.sub(r"(\d)\(", r"\1*(", s)
    s = re.sub(r"([a-zA-Z])\(", r"\1*(", s)
    s = re.sub(r"\)(\d)", r")*\1", s)
    s = re.sub(r"\)([a-zA-Z])", r")*\1", s)
    s = re.sub(r"\)\(", r")*(", s)
    return s


def eval_expr(expr: str, values: dict):
    return eval(to_py(expr), {"__builtins__": {}}, values)


def vars_in(expr: str):
    return sorted(set(re.findall(r"[a-zA-Z]", expr)))


def equivalent(expr1: str, expr2: str, variables: list) -> bool:
    if expr1 == expr2:
        return True
    for _ in range(5):
        vals = {v: random.randint(1, 9) for v in variables}
        try:
            a = eval_expr(expr1, vals)
            b = eval_expr(expr2, vals)
            if abs(a - b) > 1e-6:
                return False
        except Exception:
            return False
    return True


def format_term(coef: int, sig: str) -> str:
    if coef == 0:
        return ""
    if sig == "":
        return str(coef)
    if abs(coef) == 1:
        return ("-" if coef < 0 else "") + sig
    return str(coef) + sig


def format_terms(terms: list) -> str:
    """terms is a list of {'coef': int, 'sig': str} in desired order."""
    parts = [format_term(t["coef"], t["sig"]) for t in terms if t["coef"] != 0]
    if not parts:
        return "0"
    s = parts[0]
    if s.startswith("+"):
        s = s[1:]
    for part in parts[1:]:
        if part.startswith("-"):
            s += part
        else:
            s += "+" + part
    return s


def format_poly(p: dict, sigs: list) -> str:
    parts = [format_term(p[s], s) for s in sigs if p.get(s, 0) != 0]
    if not parts:
        return "0"
    s = parts[0]
    if s.startswith("+"):
        s = s[1:]
    for part in parts[1:]:
        if part.startswith("-"):
            s += part
        else:
            s += "+" + part
    return s


def expr_latex(expr: str) -> str:
    expr = expr.strip()
    m = re.match(r"^\((.+)\)/(\d+)$", expr)
    if m:
        return f"$\\dfrac{{{m.group(1)}}}{{{m.group(2)}}}$"
    return f"${expr}$"


def make_mc(correct_latex: str, correct_answer: str, answer_type: str, distractor_latexes: list, rng: random.Random):
    items = [("a", correct_latex, True)]
    for i, dl in enumerate(distractor_latexes):
        items.append((chr(98 + i), dl, False))
    rng.shuffle(items)
    choices = [{"id": item[0], "latex": item[1]} for item in items]
    correct_choice = next(item[0] for item in items if item[2])
    return {
        "choices": choices,
        "correct_choice": correct_choice,
        "correct_answer": correct_answer,
    }


def build_problem(
    topic_id: str,
    difficulty: str,
    idx: int,
    prompt: str,
    answer_type: str,
    correct_latex: str,
    correct_answer: str,
    distractor_latexes: list,
    solution: str,
    complexity: float,
    source_section: str,
    tags: list,
    rng: random.Random,
    accepted_forms: list = None,
):
    mc = make_mc(correct_latex, correct_answer, answer_type, distractor_latexes, rng)
    p = {
        "id": f"{topic_id}.{difficulty}.{str(idx).zfill(4)}",
        "topic_id": topic_id,
        "group_id": GROUP,
        "difficulty": difficulty,
        "prompt_latex": prompt,
        "answer_format": "mc",
        "answer_type": answer_type,
        "solution_latex": solution,
        "complexity_factor": complexity,
        "source_section": source_section,
        "tags": tags,
        "status": "valid",
        **mc,
    }
    if accepted_forms:
        p["accepted_forms"] = accepted_forms
    p["checksum"] = compute_checksum(topic_id, difficulty, prompt, correct_answer)
    return p


# ---------------------------------------------------------------------------
# Numeric distractors for evaluated expressions
# ---------------------------------------------------------------------------

def numeric_distractors(expr: str, scope: dict, answer: int, rng: random.Random) -> list:
    cands = set()
    transforms = [
        (r"([a-zA-Z])\^2", r"2*\1"),
        (r"\*", "+"),
    ]
    for pat, repl in transforms:
        try:
            modified = re.sub(pat, repl, expr)
            if modified == expr:
                continue
            val = round(eval_expr(modified, scope))
            cands.add(val)
        except Exception:
            pass
    try:
        modified = re.sub(r"-(?!\d)", "+", expr, count=1)
        if modified != expr:
            cands.add(round(eval_expr(modified, scope)))
    except Exception:
        pass
    try:
        m = re.search(r"([+-])\s*(\d+)\s*$", expr)
        if m:
            modified = expr[: m.start()].strip()
            if modified:
                cands.add(round(eval_expr(modified, scope)))
    except Exception:
        pass
    if "x" in scope and "y" in scope and scope["x"] != scope["y"]:
        try:
            swapped = dict(scope)
            swapped["x"], swapped["y"] = swapped["y"], swapped["x"]
            cands.add(round(eval_expr(expr, swapped)))
        except Exception:
            pass
    vals = [v for v in cands if v != answer]
    delta = 1
    while len(vals) < 3:
        for sign in (1, -1):
            v = answer + delta * sign
            if v != answer and v not in vals:
                vals.append(v)
            if len(vals) >= 3:
                break
        delta += 1
    return vals[:3]


# ---------------------------------------------------------------------------
# Topic generators
# ---------------------------------------------------------------------------

def gen_eval_multivar(difficulty: str, rng: random.Random, existing_checksums: set):
    topic = "ch4.eval_multivar"
    section = "4.1"
    complexity = {"easy": 0.8, "medium": 0.9, "hard": 1.0}[difficulty]
    problems = []
    attempts = 0
    while len(problems) < COUNT and attempts < COUNT * 100:
        attempts += 1
        if difficulty == "easy":
            a = rng.randint(1, 6)
            b = rng.randint(1, 6)
            c = rng.randint(0, 12)
            x = rng.randint(1, 6)
            y = rng.randint(1, 6)
            op = rng.choice(["+", "-"])
            expr = f"{a}*x {op} {b}*y + {c}"
            tail = f" + {c}" if c else ""
            prompt = f"If $x = {x}$ and $y = {y}$, evaluate ${a}x {op} {b}y{tail}$."
        elif difficulty == "medium":
            form = rng.randint(1, 3)
            x = rng.randint(1, 5)
            y = rng.randint(1, 5)
            if form == 1:
                a, b, c, d = rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 5), rng.randint(0, 10)
                expr = f"{a}*x*y + {b}*x + {c}*y + {d}"
                tail = f" + {d}" if d else ""
                prompt = f"If $x = {x}$ and $y = {y}$, evaluate ${a}xy + {b}x + {c}y{tail}$."
            elif form == 2:
                a, b, c = rng.randint(1, 5), rng.randint(1, 5), rng.randint(0, 10)
                expr = f"{a}*x^2 + {b}*y + {c}"
                tail = f" + {c}" if c else ""
                prompt = f"If $x = {x}$ and $y = {y}$, evaluate ${a}x^2 + {b}y{tail}$."
            else:
                a, b, c = rng.randint(1, 4), rng.randint(1, 4), rng.randint(0, 8)
                expr = f"({a}*x + {b})*y + {c}"
                tail = f" + {c}" if c else ""
                prompt = f"If $x = {x}$ and $y = {y}$, evaluate $({a}x + {b})y{tail}$."
        else:
            form = rng.randint(1, 4)
            if form == 1:
                a, b, c = rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, 3)
                x, y = rng.randint(1, 3), rng.randint(1, 3)
                expr = f"{a}*x^2*y + {b}*x*y^2 + {c}*x*y"
                prompt = f"If $x = {x}$ and $y = {y}$, evaluate ${a}x^2y + {b}xy^2 + {c}xy$."
            elif form == 2:
                a = rng.randint(1, 3)
                b = rng.choice([-3, -2, -1, 1, 2, 3])
                x, y = rng.randint(1, 4), rng.randint(1, 4)
                expr = f"{a}*(x + y)^2 + {b}*(x - y)"
                bsign = "+" if b > 0 else "-"
                prompt = f"If $x = {x}$ and $y = {y}$, evaluate ${a}(x + y)^2 {bsign} {abs(b)}(x - y)$."
            elif form == 3:
                a, b, c, d = rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, 3)
                x, y = rng.randint(1, 3), rng.randint(1, 3)
                expr = f"({a}*x + {b}*y)*({c}*x - {d}*y)"
                prompt = f"If $x = {x}$ and $y = {y}$, evaluate $({a}x + {b}y)({c}x - {d}y)$."
            else:
                a, b, c = rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, 3)
                x, y, z = rng.randint(1, 3), rng.randint(1, 3), rng.randint(1, 3)
                expr = f"{a}*x*y*z + {b}*x*y + {c}*y*z"
                prompt = f"If $x = {x}$, $y = {y}$, and $z = {z}$, evaluate ${a}xyz + {b}xy + {c}yz$."

        scope = {"x": x, "y": y}
        if "z" in expr:
            scope["z"] = z
        try:
            answer = round(eval_expr(expr, scope))
        except Exception:
            continue

        dists = numeric_distractors(expr, scope, answer, rng)
        p = build_problem(
            topic, difficulty, len(problems) + 1, prompt, "integer",
            f"${answer}$", str(answer), [f"${v}$" for v in dists],
            f"Substitute the values and simplify to get ${answer}$.",
            complexity, section, ["evaluating", "multi_variable"], rng
        )
        if p["checksum"] not in existing_checksums:
            existing_checksums.add(p["checksum"])
            problems.append(p)
    return problems


def gen_more_arithmetic(difficulty: str, rng: random.Random, existing_checksums: set):
    topic = "ch4.more_arithmetic"
    section = "4.2"
    complexity = {"easy": 0.8, "medium": 0.9, "hard": 1.0}[difficulty]
    sigs_map = {
        "easy": ["x", "y"],
        "medium": ["x", "y", "z", ""],
        "hard": ["x^2", "xy", "y^2", "x", "y", ""],
    }
    sigs = sigs_map[difficulty]
    problems = []
    attempts = 0
    while len(problems) < COUNT and attempts < COUNT * 200:
        attempts += 1
        p1 = {sig: rng.randint(-9, 9) for sig in sigs}
        p2 = {sig: rng.randint(-9, 9) for sig in sigs}
        if all(v == 0 for v in p1.values()) or all(v == 0 for v in p2.values()):
            continue
        subtract = rng.random() < 0.5
        op = " - " if subtract else " + "
        left = format_poly(p1, sigs)
        right = format_poly(p2, sigs)
        prompt = f"Simplify: $({left}){op}({right})$."
        result = {}
        for sig in sigs:
            a = p1.get(sig, 0)
            b = p2.get(sig, 0)
            result[sig] = a - b if subtract else a + b
        terms = [{"coef": result[sig], "sig": sig} for sig in sigs if result[sig] != 0]
        if not terms:
            continue
        correct = format_terms(terms)
        variables = vars_in(correct)

        cands = set()
        # flip sign of a term
        for i in range(len(terms)):
            copy = [dict(t) for t in terms]
            copy[i]["coef"] = -copy[i]["coef"]
            e = format_terms(copy)
            if not equivalent(e, correct, variables):
                cands.add(e)
        # adjust a coefficient by +-1
        for i in range(len(terms)):
            for delta in (-1, 1):
                copy = [dict(t) for t in terms]
                copy[i]["coef"] += delta
                e = format_terms(copy)
                if not equivalent(e, correct, variables):
                    cands.add(e)
        # drop a term
        for i in range(len(terms)):
            copy = [terms[j] for j in range(len(terms)) if j != i]
            e = format_terms(copy)
            if e != correct and not equivalent(e, correct, variables):
                cands.add(e)
        # combine first two coefficients incorrectly
        if len(terms) >= 2:
            copy = [dict(t) for t in terms]
            copy[0]["coef"] += copy[1]["coef"]
            del copy[1]
            e = format_terms(copy)
            if not equivalent(e, correct, variables):
                cands.add(e)

        distractors = list(cands)[:3]
        k = 1
        while len(distractors) < 3:
            e = correct + ("+1" if "" not in [t["sig"] for t in terms] else "+x")
            if not equivalent(e, correct, variables):
                distractors.append(e)
            k += 1

        p = build_problem(
            topic, difficulty, len(problems) + 1, prompt, "expression",
            expr_latex(correct), correct, [expr_latex(e) for e in distractors],
            f"Combine like terms to get ${correct}$.",
            complexity, section, ["combining_like_terms", "arithmetic"], rng,
            accepted_forms=[correct]
        )
        if p["checksum"] not in existing_checksums:
            existing_checksums.add(p["checksum"])
            problems.append(p)
    return problems


def gen_distribution_factoring(difficulty: str, rng: random.Random, existing_checksums: set):
    topic = "ch4.distribution_factoring"
    section = "4.3"
    complexity = {"easy": 0.9, "medium": 1.0, "hard": 1.1}[difficulty]
    problems = []
    attempts = 0

    def var_part(exp: int, var: str) -> str:
        if exp == 0:
            return ""
        if exp == 1:
            return var
        return f"{var}^{exp}"

    while len(problems) < COUNT and attempts < COUNT * 200:
        attempts += 1
        kind = rng.randint(1, 3)
        prompt = ""
        correct = ""
        distractors = []

        if difficulty == "easy":
            if kind == 1:
                a, b, c = rng.randint(2, 6), rng.randint(1, 5), rng.randint(1, 5)
                correct = f"{a*b}*x + {a*c}*y"
                prompt = f"Expand: ${a}({b}x + {c}y)$."
                distractors = [
                    f"{a*b}x + {c}y",
                    f"{a + b}x + {a + c}y",
                    f"{a*b}x - {a*c}y",
                ]
            else:
                a, b, c = rng.randint(2, 6), rng.randint(2, 6), rng.randint(2, 6)
                g = math.gcd(math.gcd(a * b, a * c), a)
                correct = f"{g}*({a*b//g}x + {a*c//g}y)"
                prompt = f"Factor completely: ${a*b}x + {a*c}y$."
                distractors = [
                    f"{a}({b}x + {c}y)",
                    f"{g}({a*b}x + {a*c}y)",
                    f"x({a*b} + {a*c}y)",
                ]
        elif difficulty == "medium":
            if kind <= 2:
                a, b, c = rng.randint(2, 5), rng.randint(1, 4), rng.randint(1, 4)
                correct = f"{-a*b}*x + {a*c}*y"
                prompt = f"Expand: $-{a}({b}x - {c}y)$."
                distractors = [
                    f"{-a*b}x - {a*c}y",
                    f"{a*b}x + {a*c}y",
                    f"{-a*b}x + {c}y",
                ]
            else:
                c1, c2 = rng.randint(2, 8), rng.randint(2, 8)
                g = math.gcd(c1, c2)
                x1, x2 = rng.randint(1, 2), rng.randint(1, 2)
                y1, y2 = rng.randint(0, 2), rng.randint(0, 2)
                minx, miny = min(x1, x2), min(y1, y2)
                gp = f"{g}" + var_part(minx, "x") + var_part(miny, "y")
                inner1 = f"{c1 // g}" + var_part(x1 - minx, "x") + var_part(y1 - miny, "y")
                inner2 = f"{c2 // g}" + var_part(x2 - minx, "x") + var_part(y2 - miny, "y")
                correct = f"{gp}*({inner1} + {inner2})"
                t1 = f"{c1}" + var_part(x1, "x") + var_part(y1, "y")
                t2 = f"{c2}" + var_part(x2, "x") + var_part(y2, "y")
                prompt = f"Factor completely: ${t1} + {t2}$."
                distractors = [
                    f"{g}({t1} + {t2})",
                    f"{gp}({c1}{var_part(x1, 'x')}{var_part(y1, 'y')} + {c2}{var_part(x2, 'x')}{var_part(y2, 'y')})",
                    f"{t1}({g} + {c2}{var_part(x2, 'x')}{var_part(y2, 'y')})",
                ]
        else:
            if kind == 1:
                a, b, c, d = rng.randint(1, 4), rng.randint(1, 4), rng.randint(1, 4), rng.randint(1, 4)
                correct = f"{a*c}*x^2 + {a*d + b*c}*x*y + {b*d}*y^2"
                prompt = f"Expand: $({a}x + {b}y)({c}x + {d}y)$."
                distractors = [
                    f"{a*c}x^2 + {b*d}y^2",
                    f"{a*c + b*d}x^2y^2",
                    f"{a + c}x + {b + d}y",
                ]
            elif kind == 2:
                a, b = rng.randint(2, 5), rng.randint(2, 5)
                correct = f"({a} + {b})*(x + y)"
                prompt = f"Factor completely: ${a}x + {a}y + {b}x + {b}y$."
                distractors = [
                    f"({a} + {b})(x - y)",
                    f"x({a} + {b}) + y",
                    f"({a}x + {b})(x + y)",
                ]
            else:
                g, a, b, c = rng.randint(2, 5), rng.randint(1, 4), rng.randint(1, 4), rng.randint(1, 4)
                correct = f"{g}*({a}*x^2 + {b}*x*y + {c}*y^2)"
                prompt = f"Factor completely: ${g*a}x^2 + {g*b}xy + {g*c}y^2$."
                distractors = [
                    f"{g}x({a}x^2 + {b}xy + {c}y^2)",
                    f"x({g*a}x^2 + {g*b}xy + {g*c}y^2)",
                    f"{g}({a}x + {b}y)({c}x + y)",
                ]

        try:
            py_correct = to_py(correct)
            eval_expr(correct, {v: 2 for v in vars_in(correct)})
        except Exception:
            continue

        variables = vars_in(correct)
        valid = []
        for d in distractors:
            try:
                if not equivalent(d, correct, variables):
                    valid.append(d)
            except Exception:
                valid.append(d)
        if len(valid) < 3:
            continue

        p = build_problem(
            topic, difficulty, len(problems) + 1, prompt, "expression",
            expr_latex(correct), correct, [expr_latex(d) for d in valid[:3]],
            "Apply the distributive property or factor out the greatest common factor.",
            complexity, section, ["distribution", "factoring", "gcf"], rng,
            accepted_forms=[correct]
        )
        if p["checksum"] not in existing_checksums:
            existing_checksums.add(p["checksum"])
            problems.append(p)
    return problems


def gen_fractions(difficulty: str, rng: random.Random, existing_checksums: set):
    topic = "ch4.fractions"
    section = "4.4"
    complexity = {"easy": 0.9, "medium": 1.0, "hard": 1.1}[difficulty]
    problems = []
    attempts = 0

    while len(problems) < COUNT and attempts < COUNT * 200:
        attempts += 1
        if difficulty == "easy":
            op = rng.choice(["+", "-", "*", "÷"])
            a = (rng.randint(1, 5), rng.randint(2, 6))
            if op in ("+", "-"):
                den = a[1]
                b = (rng.randint(1, 5), den if rng.random() < 0.5 else den * rng.randint(2, 3))
            else:
                b = (rng.randint(1, 5), rng.randint(2, 6))
            answer = {"+": add_frac, "-": sub_frac, "*": mul_frac, "÷": div_frac}[op](a, b)
            latex_op = {"*": "\\cdot", "÷": "\\div"}.get(op, op)
            prompt = f"Compute $\\dfrac{{{a[0]}}}{{{a[1]}}} {latex_op} \\dfrac{{{b[0]}}}{{{b[1]}}}$."
        elif difficulty == "medium":
            op = rng.choice(["+", "-", "*", "÷"])
            a = (rng.randint(1, 8), rng.randint(2, 8))
            b = (rng.randint(1, 8), rng.randint(2, 8))
            answer = {"+": add_frac, "-": sub_frac, "*": mul_frac, "÷": div_frac}[op](a, b)
            latex_op = {"*": "\\cdot", "÷": "\\div"}.get(op, op)
            prompt = f"Compute $\\dfrac{{{a[0]}}}{{{a[1]}}} {latex_op} \\dfrac{{{b[0]}}}{{{b[1]}}}$."
        else:
            a = (rng.randint(1, 6), rng.randint(2, 6))
            b = (rng.randint(1, 6), rng.randint(2, 6))
            c = (rng.randint(1, 6), rng.randint(2, 6))
            form = rng.randint(1, 3)
            if form == 1:
                answer = mul_frac(add_frac(a, b), c)
                prompt = f"Compute $\\left(\\dfrac{{{a[0]}}}{{{a[1]}}} + \\dfrac{{{b[0]}}}{{{b[1]}}}\\right) \\cdot \\dfrac{{{c[0]}}}{{{c[1]}}}$."
            elif form == 2:
                answer = add_frac(div_frac(a, b), c)
                prompt = f"Compute $\\dfrac{{{a[0]}}}{{{a[1]}}} \\div \\dfrac{{{b[0]}}}{{{b[1]}}} + \\dfrac{{{c[0]}}}{{{c[1]}}}$."
            else:
                answer = sub_frac(a, mul_frac(b, c))
                prompt = f"Compute $\\dfrac{{{a[0]}}}{{{a[1]}}} - \\dfrac{{{b[0]}}}{{{b[1]}}} \\cdot \\dfrac{{{c[0]}}}{{{c[1]}}}$."

        if answer[0] < 0:
            continue

        answer_type = "integer" if answer[1] == 1 else "fraction"
        correct_latex = frac_latex(answer[0], answer[1])
        correct_answer = frac_str(answer[0], answer[1])

        cands = []

        def add_cand(n, d):
            if d == 0:
                return
            r = reduce_frac(n, d)
            if r[0] >= 0:
                cands.append(r)

        # generic near-miss distractors
        add_cand(answer[0] + 1, answer[1])
        add_cand(answer[0] - 1, answer[1])
        add_cand(answer[0], answer[1] + 1)
        add_cand(answer[0], max(2, answer[1] - 1))

        def accepts(r):
            if answer_type == "integer":
                return r[1] == 1
            return r[1] > 1

        seen = set()
        valid = []
        for r in cands:
            key = f"{r[0]}/{r[1]}"
            if key in seen or (r[0] == answer[0] and r[1] == answer[1]) or not accepts(r):
                continue
            seen.add(key)
            valid.append(r)
        delta = 1
        while len(valid) < 3:
            if answer_type == "integer":
                add_cand(answer[0] + delta, 1)
                if answer[0] - delta >= 0:
                    add_cand(answer[0] - delta, 1)
            else:
                add_cand(answer[0] + delta, answer[1])
                add_cand(answer[0] - delta, answer[1])
                add_cand(answer[0], answer[1] + delta)
                add_cand(answer[0], answer[1] + delta + 1)
            # re-filter newly added candidates
            for r in cands[len(seen):] if False else cands:
                key = f"{r[0]}/{r[1]}"
                if key in seen or (r[0] == answer[0] and r[1] == answer[1]) or not accepts(r):
                    continue
                seen.add(key)
                valid.append(r)
                if len(valid) >= 3:
                    break
            delta += 1
            if delta > 100:
                break

        if len(valid) < 3:
            continue

        dist_latex = [frac_latex(r[0], r[1]) for r in valid[:3]]
        p = build_problem(
            topic, difficulty, len(problems) + 1, prompt, answer_type,
            correct_latex, correct_answer, dist_latex,
            f"Simplify to get {correct_latex}.",
            complexity, section, ["fractions", "arithmetic"], rng
        )
        if p["checksum"] not in existing_checksums:
            existing_checksums.add(p["checksum"])
            problems.append(p)
    return problems


def gen_equations(difficulty: str, rng: random.Random, existing_checksums: set):
    topic = "ch4.equations"
    section = "4.5"
    complexity = {"easy": 0.9, "medium": 1.0, "hard": 1.1}[difficulty]
    problems = []
    attempts = 0

    while len(problems) < COUNT and attempts < COUNT * 300:
        attempts += 1
        prompt = ""
        correct_answer = ""
        correct_latex = ""
        answer_type = "integer"
        solution = ""
        distractors = []

        if difficulty == "easy":
            form = rng.randint(1, 3)
            if form == 1:
                a = rng.randint(2, 6)
                c = rng.randint(2, 6)
                while c == a:
                    c = rng.randint(2, 6)
                b = rng.randint(1, 12)
                x = rng.randint(1, 8)
                d = a * x + b - c * x
                prompt = f"Solve for $x$: ${a}x + {b} = {c}x + {d}$."
                correct_answer = str(x)
                solution = f"Subtract ${c}x$ and ${b}$: ${a - c}x = {d - b}$, so $x = {x}$."
                distractors = [str(-x), str(x + 1), str(d - b)]
            elif form == 2:
                a = rng.randint(2, 5)
                b = rng.randint(1, 6)
                x = rng.randint(1, 8)
                c = a * (x + b)
                prompt = f"Solve for $x$: ${a}(x + {b}) = {c}$."
                correct_answer = str(x)
                solution = f"Divide by ${a}$ and subtract ${b}$: $x = {x}$."
                distractors = [str(c // a), str(x + b), str(-x)]
            else:
                a = rng.randint(2, 5)
                b = rng.randint(1, 10)
                x = rng.randint(1, 8)
                c = a * x - b
                prompt = f"Solve for $x$: ${a}x - {b} = {c}$."
                correct_answer = str(x)
                solution = f"Add ${b}$ and divide by ${a}$: $x = {x}$."
                distractors = [str(c + b), str(x + 1), str(-x)]
            correct_latex = f"${correct_answer}$"

        elif difficulty == "medium":
            form = rng.randint(1, 4)
            if form == 1:
                a = rng.randint(2, 4)
                b = rng.randint(2, 4)
                c = rng.randint(1, 6)
                d = rng.randint(2, 5)
                x = rng.randint(1, 6)
                e = a * (b * x + c) - d * x
                prompt = f"Solve for $x$: ${a}({b}x + {c}) = {d}x + {e}$."
                correct_answer = str(x)
                solution = f"Distribute, collect $x$ terms, and solve: $x = {x}$."
                distractors = [str(a * c - e), str(x + 1), str(-x)]
            elif form == 2:
                a = rng.randint(1, 5)
                b = rng.randint(2, 5)
                c = rng.randint(5, 20)
                correct_answer = f"({c}-{a}x)/{b}"
                prompt = f"Solve for $y$: ${a}x + {b}y = {c}$."
                solution = f"Isolate $y$: $y = \\dfrac{{{c} - {a}x}}{{{b}}}$."
                distractors = [
                    f"({a}x-{c})/{b}",
                    f"{c}-{a}x/{b}",
                    f"({c}-{a}x)*{b}",
                ]
                answer_type = "expression"
            elif form == 3:
                b = rng.randint(2, 5)
                c = rng.randint(2, 8)
                x = rng.randint(1, 8)
                a = b * c - x
                prompt = f"Solve for $x$: $\\dfrac{{x + {a}}}{{{b}}} = {c}$."
                correct_answer = str(x)
                solution = f"Multiply by ${b}$ and subtract ${a}$: $x = {x}$."
                distractors = [str(b * c + a), str(c - a), str(x + 1)]
            else:
                a = rng.randint(2, 5)
                b = rng.randint(1, 8)
                c = rng.randint(2, 8)
                x = rng.randint(1, 6)
                d = a * x + b - c
                prompt = f"Solve for $x$: ${a}x + {b} = x + {d}$."
                correct_answer = str(x)
                solution = f"Subtract $x$ and ${b}$: ${a - 1}x = {d - b}$, so $x = {x}$."
                distractors = [str(d - b), str(x + 1), str(-x)]
            correct_latex = f"${correct_answer}$" if answer_type == "integer" else expr_latex(correct_answer)

        else:
            form = rng.randint(1, 4)
            if form == 1:
                a = rng.randint(1, 4)
                b = rng.randint(1, 8)
                c = rng.randint(2, 5)
                d = rng.randint(1, 4)
                f = rng.randint(2, 5)
                g = rng.randint(0, 3)
                x = rng.randint(1, 6)
                left = (a * x + b) / c
                e = f * (left - g) - d * x
                e = round(e)
                prompt = f"Solve for $x$: $\\dfrac{{{a}x + {b}}}{{{c}}} = \\dfrac{{{d}x + {e}}}{{{f}}} + {g}$."
                correct_answer = str(x)
                solution = f"Clear denominators and simplify: $x = {x}$."
                distractors = [str(-x), str(x + 1), str(round(f * (left - g)))]
            elif form == 2:
                a = rng.randint(2, 5)
                b = rng.randint(1, 5)
                c = rng.randint(1, 12)
                correct_answer = f"({b}y+{c})/{a}-y"
                prompt = f"Solve for $x$: ${a}(x + y) = {b}y + {c}$."
                solution = f"Divide by ${a}$ and subtract $y$: $x = \\dfrac{{{b}y + {c}}}{{{a}}} - y$."
                distractors = [
                    f"({b}y+{c})/{a}+y",
                    f"({b}y+{c})/{a}",
                    f"{b}y+{c}-y",
                ]
                answer_type = "expression"
            elif form == 3:
                a = rng.randint(2, 5)
                c = rng.randint(2, 5)
                b = rng.randint(1, 8)
                d = rng.randint(1, 12)
                # ax + by = cx + d -> x = (d - by)/(a-c)
                correct_answer = f"({d}-{b}y)/{a-c}"
                prompt = f"Solve for $x$: ${a}x + {b}y = {c}x + {d}$."
                solution = f"Collect $x$ terms: $x = \\dfrac{{{d} - {b}y}}{{{a - c}}}$."
                distractors = [
                    f"({d}-{b}y)/{a+c}",
                    f"{d}-{b}y",
                    f"({b}y-{d})/{a-c}",
                ]
                answer_type = "expression"
            else:
                a = rng.randint(2, 4)
                b = rng.randint(1, 8)
                c = rng.randint(2, 5)
                d = rng.randint(1, 8)
                # (ax+b)/c = dx + e; choose x then e
                x = rng.randint(1, 6)
                e = round((a * x + b) / c - d * x)
                ans = reduce_frac(c * e - b, a - c * d)
                answer_type = "integer" if ans[1] == 1 else "fraction"
                correct_answer = frac_str(ans[0], ans[1])
                prompt = f"Solve for $x$: $\\dfrac{{{a}x + {b}}}{{{c}}} = {d}x + {e}$."
                solution = f"Multiply by ${c}$, collect terms, and solve."
                if answer_type == "integer":
                    distractors = [str(-ans[0]), str(ans[0] + 1), str(c * e - b)]
                else:
                    distractors = [
                        frac_str(ans[0] + 1, ans[1]),
                        frac_str(ans[0], ans[1] + 1),
                        frac_str(c * e - b, a - c * d),
                    ]
            correct_latex = f"${correct_answer}$" if answer_type == "integer" else expr_latex(correct_answer)

        # filter expression distractors for equivalence
        if answer_type == "expression":
            variables = vars_in(correct_answer)
            valid = []
            for d in distractors:
                try:
                    if not equivalent(d, correct_answer, variables):
                        valid.append(d)
                except Exception:
                    valid.append(d)
            if len(valid) < 3:
                continue
            distractors = valid[:3]
        else:
            # ensure distractors are distinct values different from correct
            seen = set()
            valid = []
            for d in distractors:
                if d != correct_answer and d not in seen:
                    seen.add(d)
                    valid.append(d)
            if len(valid) < 3:
                if answer_type == "integer":
                    x_val = int(correct_answer)
                    extras = [str(-x_val), str(x_val + 2), str(x_val - 2)]
                    for e in extras:
                        if e != correct_answer and e not in seen:
                            seen.add(e)
                            valid.append(e)
                else:
                    # fraction fallback
                    num, den = map(int, correct_answer.split("/"))
                    extras = [
                        frac_str(num + 1, den),
                        frac_str(num - 1, den),
                        frac_str(num, den + 1),
                    ]
                    for e in extras:
                        if e != correct_answer and e not in seen:
                            seen.add(e)
                            valid.append(e)
            if len(valid) < 3:
                continue
            distractors = valid[:3]

        dist_latex = [expr_latex(d) if answer_type == "expression" else f"${d}$" for d in distractors]
        p = build_problem(
            topic, difficulty, len(problems) + 1, prompt, answer_type,
            correct_latex, correct_answer, dist_latex,
            solution, complexity, section, ["equations", "solving"], rng,
            accepted_forms=[correct_answer] if answer_type == "expression" else None
        )
        if p["checksum"] not in existing_checksums:
            existing_checksums.add(p["checksum"])
            problems.append(p)
    return problems


GENERATORS = {
    "ch4.eval_multivar": gen_eval_multivar,
    "ch4.more_arithmetic": gen_more_arithmetic,
    "ch4.distribution_factoring": gen_distribution_factoring,
    "ch4.fractions": gen_fractions,
    "ch4.equations": gen_equations,
}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    checksums = set()
    total = 0
    for topic_id, generator in GENERATORS.items():
        for difficulty in DIFFICULTIES:
            rng = random.Random(f"{topic_id}-{difficulty}-2026")
            problems = generator(difficulty, rng, checksums)
            if len(problems) < COUNT:
                raise RuntimeError(f"Failed to generate {COUNT} problems for {topic_id} {difficulty} (got {len(problems)})")
            file_path = os.path.join(OUT_DIR, f"{topic_id}.{difficulty}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(problems, f, indent=2)
            print(f"Wrote {len(problems)} problems to {file_path}")
            total += len(problems)
    print(f"Total generated: {total}")


if __name__ == "__main__":
    main()
