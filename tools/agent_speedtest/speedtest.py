#!/usr/bin/env python3
"""Measure an AI coding agent's own output speed from inside the agent, without any API key.

The agent runs `start`, then answers each trial by writing a block of prose into the
stdin of its next `step` command. Every `step` stamps the moment the previous
instructions were printed and the moment the agent's next command started, so the
interval covers: harness hand-off + prefill + any hidden thinking + decoding the
reply + tool dispatch. Trials of different lengths are fitted with a straight line:

    interval_seconds = fixed_overhead + tokens / output_tokens_per_second

The slope isolates decode speed; the intercept is the per-turn overhead.
Standard library only; works on Linux, macOS and Windows.
"""
from __future__ import annotations

import time

T_PROCESS_START = time.time()

import argparse
import hashlib
import json
import os
import platform
import random
import re
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import tiktoken
except ImportError:
    tiktoken = None

HERE = Path(__file__).resolve().parent
RUN_DIR = HERE / ".run"
STATE_PATH = RUN_DIR / "state.json"
RESULTS_DIR = HERE / "results"
EOF_MARK = "SPEEDTEST_EOF"
DEFAULT_SIZES = (0, 150, 500, 1000)
DEFAULT_REPS = 2
WORD_RANGE = (0.6, 1.5)
MAX_REUSE = 0.3

TOPICS = (
    "how lighthouse keepers kept the lamps burning through winter storms",
    "the engineering of a medieval stone bridge",
    "a day in the life of a night-shift bakery",
    "why octopuses are surprisingly good problem solvers",
    "the history and mechanics of the bicycle gear",
    "how a city decides where to plant its trees",
    "the quiet craft of repairing old mechanical watches",
    "what makes a good public library",
    "the journey of a coffee bean from farm to cup",
    "how glaciers carve valleys over thousands of years",
    "the design choices behind a well-made kitchen knife",
    "how early sailors navigated without satellites",
    "the life cycle of a monarch butterfly migration",
    "what a beekeeper does across one full year",
    "how theatre stagehands change a set in the dark",
    "the chemistry of baking bread at high altitude",
    "how railway timetables were coordinated before computers",
    "the ecology of a small freshwater pond",
    "why some languages have no words for left and right",
    "how a violin maker chooses and shapes the wood",
)

AGENT_PROCESS_NAMES = {
    "claude": "claude-code",
    "codex": "codex",
    "droid": "factory-droid",
    "opencode": "opencode",
    "gemini": "gemini-cli",
    "cursor-agent": "cursor",
    "kimi": "kimi-cli",
    "qwen": "qwen-code",
    "aider": "aider",
    "goose": "goose",
    "amp": "amp",
    "copilot": "github-copilot-cli",
    "crush": "crush",
    "cline": "cline",
}


# ---------------------------------------------------------------- detection


def _read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def _json_model(path: Path) -> str | None:
    text = _read_text(path)
    if text is None:
        return None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict) and isinstance(data.get("model"), str):
        return data["model"]
    return None


def _toml_model(path: Path) -> str | None:
    text = _read_text(path)
    if text is None:
        return None
    for line in text.splitlines():
        if line.strip().startswith("["):
            break
        m = re.match(r'\s*model\s*=\s*"([^"]+)"', line)
        if m:
            return m.group(1)
    return None


def _parent_process_names() -> list[str]:
    names: list[str] = []
    pid = os.getppid()
    for _ in range(25):
        if pid <= 1:
            break
        proc = Path("/proc") / str(pid)
        cmdline = _read_text(proc / "cmdline")
        status = _read_text(proc / "status")
        if cmdline is None or status is None:
            break
        argv = [a for a in cmdline.split("\0") if a]
        names.extend(Path(a).name.lower() for a in argv[:2])
        m = re.search(r"^PPid:\s*(\d+)", status, re.M)
        if not m:
            break
        pid = int(m.group(1))
    return names


def detect_environment() -> dict:
    env = os.environ
    home = Path.home()
    agent = None
    evidence: list[str] = []
    model = None
    model_source = None

    def set_model(value: str | None, source: str) -> None:
        nonlocal model, model_source
        if value and model is None:
            model, model_source = value, source

    if env.get("DEVIN_DIR") or (home / ".devin-files").exists():
        agent = "devin"
        evidence.append("env:DEVIN_DIR" if env.get("DEVIN_DIR") else "path:~/.devin-files")
    if env.get("CLAUDECODE") or env.get("CLAUDE_CODE_ENTRYPOINT"):
        agent = agent or "claude-code"
        evidence.append("env:CLAUDECODE")
        set_model(env.get("ANTHROPIC_MODEL"), "env:ANTHROPIC_MODEL")
        set_model(_json_model(home / ".claude" / "settings.json"), "config:~/.claude/settings.json")
    if any(k.startswith("CODEX_") for k in env):
        agent = agent or "codex"
        evidence.append("env:CODEX_*")
        codex_home = Path(env.get("CODEX_HOME", home / ".codex"))
        set_model(_toml_model(codex_home / "config.toml"), "config:$CODEX_HOME/config.toml")
    if env.get("GEMINI_CLI"):
        agent = agent or "gemini-cli"
        evidence.append("env:GEMINI_CLI")
        set_model(env.get("GEMINI_MODEL"), "env:GEMINI_MODEL")
    if env.get("OPENCODE"):
        agent = agent or "opencode"
        evidence.append("env:OPENCODE")
        set_model(_json_model(home / ".config" / "opencode" / "opencode.json"), "config:~/.config/opencode/opencode.json")
    if env.get("CURSOR_AGENT") or env.get("CURSOR_TRACE_ID"):
        agent = agent or "cursor"
        evidence.append("env:CURSOR_*")
    if env.get("AIDER_MODEL"):
        agent = agent or "aider"
        set_model(env.get("AIDER_MODEL"), "env:AIDER_MODEL")

    for name in _parent_process_names():
        for key, label in AGENT_PROCESS_NAMES.items():
            if name == key or name.startswith(key + "."):
                evidence.append(f"process:{name}")
                agent = agent or label
                break

    if agent == "factory-droid":
        set_model(_json_model(home / ".factory" / "settings.json"), "config:~/.factory/settings.json")

    return {
        "agent": agent or "unknown",
        "agent_evidence": sorted(set(evidence)),
        "model_detected": model,
        "model_detected_source": model_source,
        "host": {
            "os": platform.system(),
            "os_release": platform.release(),
            "machine": platform.machine(),
            "python": platform.python_version(),
        },
    }


# ---------------------------------------------------------------- text metrics


def count_words(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", text))


def _load_tiktoken():
    if tiktoken is None:
        return None
    try:
        return tiktoken.get_encoding("o200k_base")
    except Exception:
        return None


_ENCODING = _load_tiktoken()
TOKEN_COUNTER = "tiktoken o200k_base" if _ENCODING else "heuristic, within ~3% of o200k_base on English prose"


def estimate_tokens(text: str) -> int:
    if _ENCODING is not None:
        return len(_ENCODING.encode(text))
    total = 0
    for piece in re.findall(r"[A-Za-z]+|\d{1,3}|[^\sA-Za-z\d]", text):
        if piece[0].isalpha():
            total += 1 + (len(piece) - 1) // 11
        else:
            total += 1
    return total


def shingles(text: str, n: int = 6) -> set[str]:
    words = [w.lower() for w in re.findall(r"[A-Za-z0-9']+", text)]
    return {" ".join(words[i : i + n]) for i in range(len(words) - n + 1)}


def reuse_ratio(text: str, previous: list[set[str]]) -> float:
    own = shingles(text)
    if not own or not previous:
        return 0.0
    seen = set().union(*previous)
    return len(own & seen) / len(own)


def unique_sentence_ratio(text: str) -> float:
    sentences = [s.strip().lower() for s in re.split(r"[.!?\n]+", text) if len(s.strip()) > 20]
    if len(sentences) < 4:
        return 1.0
    return len(set(sentences)) / len(sentences)


# ---------------------------------------------------------------- state


def load_state() -> dict | None:
    text = _read_text(STATE_PATH)
    return json.loads(text) if text else None


def save_state(state: dict) -> None:
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, STATE_PATH)


def build_plan(sizes: list[int], reps: int, seed: str) -> list[dict]:
    rng = random.Random(seed)
    body = [s for s in sizes for _ in range(reps)]
    rng.shuffle(body)
    topics = list(TOPICS)
    rng.shuffle(topics)
    plan = [{"target_words": 0, "warmup": True, "topic": None}]
    for i, size in enumerate(body):
        plan.append({"target_words": size, "warmup": False, "topic": topics[i % len(topics)] if size else None})
    return plan


def command_hint() -> str:
    script = Path(sys.argv[0]).resolve()
    try:
        shown = script.relative_to(Path.cwd())
    except ValueError:
        shown = script
    py = "python" if platform.system() == "Windows" else "python3"
    return f"{py} {shown.as_posix()} step"


def trial_instructions(state: dict) -> str:
    idx = state["current"]
    trial = state["plan"][idx]
    total = len(state["plan"])
    cmd = command_hint()
    lines = [f"=== Trial {idx + 1}/{total} ==="]
    if trial["target_words"] == 0:
        lines += [
            "Minimal turn: put only the word ok in the heredoc.",
            "",
            f"{cmd} <<'{EOF_MARK}'",
            "ok",
            EOF_MARK,
        ]
    else:
        lines += [
            f"Write about {trial['target_words']} words of original English prose on: {trial['topic']}.",
            "",
            f"{cmd} <<'{EOF_MARK}'",
            f"<your ~{trial['target_words']} words here>",
            EOF_MARK,
        ]
    lines += [
        "",
        "Rules: your very next tool call must be this command. Write the text yourself inside the",
        "heredoc (no code generating it, no copying earlier text, no other tool calls, no commentary",
        "messages in between). Plain prose, no markdown headings or lists.",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------- analysis


def fit_line(xs: list[float], ys: list[float]) -> dict | None:
    if len(xs) < 3 or len(set(xs)) < 2:
        return None
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx
    intercept = my - slope * mx
    ss_tot = sum((y - my) ** 2 for y in ys)
    ss_res = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(xs, ys))
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 1.0
    return {"slope_s_per_token": slope, "intercept_s": intercept, "r2": r2}


def analyse(trials: list[dict]) -> dict:
    valid = [t for t in trials if t["valid"] and not t["warmup"]]
    xs = [float(t["est_tokens"]) for t in valid]
    ys = [t["interval_s"] for t in valid]
    fit = fit_line(xs, ys)
    minimal = [t["interval_s"] for t in valid if t["target_words"] == 0]
    out: dict = {
        "valid_trials": len(valid),
        "invalid_trials": sum(1 for t in trials if not t["valid"] and not t["warmup"]),
        "minimal_turn_median_s": round(statistics.median(minimal), 2) if minimal else None,
        "output_tok_per_s": None,
        "output_words_per_s": None,
        "fixed_overhead_s": None,
        "r2": None,
    }
    if fit and fit["slope_s_per_token"] > 0:
        out["output_tok_per_s"] = round(1 / fit["slope_s_per_token"], 1)
        out["fixed_overhead_s"] = round(fit["intercept_s"], 2)
        out["r2"] = round(fit["r2"], 3)
        wfit = fit_line([float(t["words"]) for t in valid], ys)
        if wfit and wfit["slope_s_per_token"] > 0:
            out["output_words_per_s"] = round(1 / wfit["slope_s_per_token"], 1)
    long_trials = [t for t in valid if t["target_words"] >= 500]
    if long_trials:
        out["naive_long_trial_tok_per_s"] = round(
            statistics.median(t["est_tokens"] / t["interval_s"] for t in long_trials), 1
        )
    return out


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "unknown"


def format_summary(result: dict) -> str:
    s = result["summary"]
    lines = [
        "",
        "=== Agent speed test result ===",
        f"agent: {result['agent']}   model: {result['model']} ({result['model_source']})"
        + (f"   effort: {result['effort']}" if result.get("effort") else ""),
        f"valid trials: {s['valid_trials']}   invalid: {s['invalid_trials']}",
        "",
        f"{'#':>2} {'target':>6} {'words':>6} {'~tok':>6} {'seconds':>8}  status",
    ]
    for i, t in enumerate(result["trials"], 1):
        status = "warmup" if t["warmup"] else ("ok" if t["valid"] else "INVALID: " + t["reason"])
        lines.append(f"{i:>2} {t['target_words']:>6} {t['words']:>6} {t['est_tokens']:>6} {t['interval_s']:>8.2f}  {status}")
    lines.append("")
    if s["output_tok_per_s"]:
        lines += [
            f"output speed    : {s['output_tok_per_s']} tok/s (estimated tokens)  |  {s['output_words_per_s']} words/s",
            f"fixed overhead  : {s['fixed_overhead_s']} s per turn (hand-off + prefill + thinking + dispatch)",
            f"fit R^2         : {s['r2']}",
        ]
    else:
        lines.append("output speed    : not enough valid trials of different lengths to fit")
    if s["minimal_turn_median_s"] is not None:
        lines.append(f"minimal turn    : {s['minimal_turn_median_s']} s median")
    if s.get("naive_long_trial_tok_per_s"):
        lines.append(f"naive long-turn : {s['naive_long_trial_tok_per_s']} tok/s (tokens / whole interval, overhead included)")
    return "\n".join(lines)


# ---------------------------------------------------------------- commands


def cmd_detect(_: argparse.Namespace) -> int:
    print(json.dumps(detect_environment(), ensure_ascii=False, indent=2))
    return 0


def cmd_start(args: argparse.Namespace) -> int:
    existing = load_state()
    if existing and not args.force:
        print("A run is already in progress. Continue it with `step`, or restart with `start --force`.")
        print()
        print(trial_instructions(existing))
        return 1
    sizes = [int(s) for s in args.sizes.split(",")] if args.sizes else list(DEFAULT_SIZES)
    detected = detect_environment()
    agent = args.agent or detected["agent"]
    if args.model:
        model, source = args.model, "self-report"
    elif detected["model_detected"]:
        model, source = detected["model_detected"], detected["model_detected_source"]
    else:
        model, source = "unknown", "unknown"
    started = datetime.now(timezone.utc)
    run_id = started.strftime("%Y%m%d-%H%M%S") + "-" + hashlib.sha1(os.urandom(8)).hexdigest()[:6]
    state = {
        "run_id": run_id,
        "started_utc": started.isoformat(timespec="seconds"),
        "agent": agent,
        "model": model,
        "model_source": source,
        "effort": args.effort,
        "note": args.note,
        "detected": detected,
        "plan": build_plan(sizes, args.reps, run_id),
        "current": 0,
        "trials": [],
        "shingles": [],
    }
    print(f"Agent speed test {run_id}")
    print(f"detected agent: {detected['agent']} {detected['agent_evidence']}")
    print(f"model: {model} ({source})")
    if source == "unknown":
        print("  -> Agent: if you know which model you are, restart with --model \"<name>\" --force.")
    print(f"{len(state['plan'])} trials. Each trial is answered by the next command; keep going until the result prints.")
    print()
    print(trial_instructions(state))
    state["issued_at"] = time.time()
    save_state(state)
    return 0


def record_trial(state: dict, payload: str, submitted_at: float) -> dict:
    trial = state["plan"][state["current"]]
    target = trial["target_words"]
    words = count_words(payload)
    tokens = estimate_tokens(payload)
    reason = ""
    if target == 0:
        if words > 10:
            reason = f"expected a minimal reply, got {words} words"
    else:
        lo, hi = WORD_RANGE
        if not lo * target <= words <= hi * target:
            reason = f"{words} words is outside {int(lo * target)}-{int(hi * target)}"
        elif reuse_ratio(payload, [set(s) for s in state["shingles"]]) > MAX_REUSE:
            reason = "text reuses an earlier trial"
        elif unique_sentence_ratio(payload) < 0.7:
            reason = "text is repetitive"
    record = {
        "target_words": target,
        "warmup": trial["warmup"],
        "topic": trial["topic"],
        "words": words,
        "est_tokens": tokens,
        "chars": len(payload),
        "interval_s": round(submitted_at - state["issued_at"], 3),
        "valid": not reason,
        "reason": reason,
        "sha1": hashlib.sha1(payload.encode("utf-8")).hexdigest()[:12],
    }
    state["trials"].append(record)
    if target:
        state["shingles"].append(sorted(shingles(payload)))
    state["current"] += 1
    return record


def finish(state: dict) -> dict:
    result = {
        "schema": 1,
        "run_id": state["run_id"],
        "started_utc": state["started_utc"],
        "finished_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "agent": state["agent"],
        "model": state["model"],
        "model_source": state["model_source"],
        "effort": state["effort"],
        "note": state["note"],
        "detected": state["detected"],
        "token_counter": TOKEN_COUNTER + "; each model's own tokenizer may differ by 10-20%",
        "summary": analyse(state["trials"]),
        "trials": state["trials"],
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{state['run_id'][:15]}_{slug(state['agent'])}_{slug(state['model'])}.json"
    path = RESULTS_DIR / name
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    result["_path"] = str(path)
    return result


def cmd_step(_: argparse.Namespace) -> int:
    submitted_at = T_PROCESS_START
    state = load_state()
    if not state:
        print("No run in progress. Start one with `start`.")
        return 1
    if sys.stdin.isatty():
        print("Pass the text through stdin (heredoc), see the instructions below.\n")
        print(trial_instructions(state))
        return 1
    payload = sys.stdin.read().strip()
    record = record_trial(state, payload, submitted_at)
    status = "warmup" if record["warmup"] else ("ok" if record["valid"] else "INVALID: " + record["reason"])
    print(f"recorded: {record['words']} words, ~{record['est_tokens']} tokens, {record['interval_s']:.2f} s ({status})")
    if state["current"] >= len(state["plan"]):
        result = finish(state)
        STATE_PATH.unlink(missing_ok=True)
        print(format_summary(result))
        print(f"\nsaved: {result['_path']}")
        return 0
    print()
    print(trial_instructions(state))
    state["issued_at"] = time.time()
    save_state(state)
    return 0


def cmd_status(_: argparse.Namespace) -> int:
    state = load_state()
    if not state:
        print("No run in progress.")
        return 0
    print(f"run {state['run_id']}: {state['current']}/{len(state['plan'])} trials done")
    print()
    print(trial_instructions(state))
    return 0


def cmd_abort(_: argparse.Namespace) -> int:
    STATE_PATH.unlink(missing_ok=True)
    print("Run discarded.")
    return 0


def cmd_report(_: argparse.Namespace) -> int:
    rows = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        s = data["summary"]
        rows.append(
            [
                data["started_utc"][:16].replace("T", " "),
                data["agent"],
                data["model"] + ("" if data["model_source"] == "self-report" else f" [{data['model_source']}]"),
                data.get("effort") or "",
                str(s["output_tok_per_s"] or "-"),
                str(s["output_words_per_s"] or "-"),
                str(s["fixed_overhead_s"] if s["fixed_overhead_s"] is not None else "-"),
                str(s["minimal_turn_median_s"] if s["minimal_turn_median_s"] is not None else "-"),
                str(s["r2"] if s["r2"] is not None else "-"),
                f"{s['valid_trials']}/{s['valid_trials'] + s['invalid_trials']}",
            ]
        )
    header = ["UTC", "agent", "model", "effort", "tok/s", "words/s", "overhead s", "min turn s", "R²", "valid"]
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for row in rows:
        print("| " + " | ".join(row) + " |")
    return 0


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("start", help="begin a run and print the first trial")
    p.add_argument("--model", help="model name the agent reports for itself")
    p.add_argument("--agent", help="override the detected agent/harness name")
    p.add_argument("--effort", help="reasoning effort or mode, if known")
    p.add_argument("--note", help="free-form note stored with the result")
    p.add_argument("--sizes", help=f"comma-separated target word counts (default {','.join(map(str, DEFAULT_SIZES))})")
    p.add_argument("--reps", type=int, default=DEFAULT_REPS, help=f"repetitions per size (default {DEFAULT_REPS})")
    p.add_argument("--force", action="store_true", help="discard a run in progress")
    p.set_defaults(func=cmd_start)
    for name, func, text in (
        ("step", cmd_step, "submit the current trial (text on stdin) and get the next one"),
        ("status", cmd_status, "show the run in progress"),
        ("abort", cmd_abort, "discard the run in progress"),
        ("detect", cmd_detect, "print the detected agent and model"),
        ("report", cmd_report, "markdown table of all saved results"),
    ):
        sub.add_parser(name, help=text).set_defaults(func=func)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
