"""Import a saved official DeepSWE v1.1 leaderboard JSON."""
import argparse
import json
from pathlib import Path

MODELS = {
    "claude-opus-4-8": "claude-opus-4.8", "claude-sonnet-4-6": "claude-sonnet-4.6",
    "gemini-3-1-pro-preview": "gemini-3.1-pro-preview",
    **{f"gemini-3-{v}-flash": f"gemini-3.{v}-flash" for v in (5, 6, 7, 8)},
    **{f"glm-5-{v}": f"glm-5.{v}" for v in (2, 3)},
    "glm-5-3-flash": "glm-5.3-flash",
    **{f"gpt-5-6-{v}": f"gpt-5.6-{v}" for v in ("luna", "sol", "terra")},
    "gpt-5-4": "gpt-5.4", "gpt-5-5": "gpt-5.5",
    "grok-4-5": "grok-4.5", "grok-4-6": "grok-4.6",
    "kimi-k2-7-code": "kimi-k2.7-code", "qwen3-8-max": "qwen3.8-max",
    "muse-spark-1-1": "muse-spark-1.1", "muse-spark-1-2": "muse-spark-1.2",
}
URL = "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--date", required=True, help="Collection date (YYYY-MM-DD)")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    assert data["n_tasks_in_set"] == 113
    scores = []
    for row in data["rows"]:
        value = row["pass_at_1"] * 100
        assert 0 <= value <= 100
        assert row["ci_lo"] <= row["pass_at_1"] <= row["ci_hi"]
        scores.append({
            "boardId": "deepswe_1_1", "model": MODELS.get(row["model"], row["model"]),
            "variantLabel": f'{row["harness"]} - {row["model"]} ({row["reasoning_effort"]})',
            "score": value,
            "secondary": {
                "agentHarness": row["harness"], "reasoningEffort": row["reasoning_effort"],
                "ciMinus": value - row["ci_lo"] * 100,
                "ciPlus": row["ci_hi"] * 100 - value,
                "ciMethod": row["ci_method"], "meanCostUsdPerTask": row["mean_cost_usd"],
                "medianCostPerTaskUsd": row["median_cost_usd"],
                "attempted": row["n_attempted"], "passed": row["n_passed"],
                "tasksAttempted": row["n_tasks_attempted"], "runs": row["n_runs"],
                "config": row["config"],
                "costBasis": row.get("cost_basis"),
            },
            "source": URL, "checkedAt": args.date,
        })
    archive = {
        "collectedAt": args.date, "generatedAt": data["generated_at"],
        "taskCount": data["n_tasks_in_set"], "unit": data["unit"],
        "boards": [{"boardId": "deepswe_1_1", "name": "DeepSWE v1.1",
                    "metric": "Pass@1 %", "url": "https://deepswe.datacurve.ai/",
                    "snapshotDate": data["generated_at"][:10]}],
        "scores": scores,
    }
    args.output.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(scores)} configurations -> {args.output}")


if __name__ == "__main__":
    main()
