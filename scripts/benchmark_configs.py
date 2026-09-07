"""Lossless benchmark records and explicit reference mappings; never infer quota effort."""
import hashlib
import json
import re

AGENT_BOARDS = {"arena_code", "arena_agent_mode", "aa_coding_agent_index"}
EFFORT = re.compile(r"(?<![a-z0-9])(xhigh|high|medium|low|max|none|thinking)(?![a-z0-9])", re.I)


def configuration(record, archive):
    secondary = record.get("secondary", {})
    label = record["variantLabel"]
    identity = [record["boardId"], record["model"], label, record.get("checkedAt"), archive]
    cid = record["boardId"] + ":" + hashlib.sha256(json.dumps(identity).encode()).hexdigest()[:16]
    effort = EFFORT.search(label)
    harness = secondary.get("agentHarness")
    if harness is None and "codex-harness" in label.lower():
        harness = "Codex"
    minus, plus = secondary.get("ciMinus"), secondary.get("ciPlus")
    return dict(
        configuration_id=cid, board=record["boardId"], model=record["model"],
        variant=label, agent_harness=harness, reasoning_effort=effort.group(1).lower() if effort else None,
        service_mode={"cursor cli - composer 2.5 fast": "fast", "cursor cli - composer 2.5": "standard"}.get(label.lower())
                     if record["model"] == "composer-2.5" else None,
        score=record["score"], score_low=record["score"] - minus if minus is not None else None,
        score_high=record["score"] + plus if plus is not None else None,
        mean_cost_usd_per_task=secondary.get("meanCostUsdPerTask"),
        median_cost_usd_per_task=secondary.get("medianCostPerTaskUsd"),
        source=record.get("source"), checked_at=record.get("checkedAt"), archive=archive,
        raw_record=record,
    )


def candidates(row, configurations, board):
    records = [c for c in configurations if c["board"] == board and c["model"] == row["served_model"]]
    if row["served_model"] == "composer-2.5":
        mode = "fast" if row["plan_id"].endswith("_composer_fast") else "standard"
        records = [c for c in records if c["service_mode"] == mode]
    return records


def mapping(record):
    agent = record["board"] in AGENT_BOARDS
    return dict(
        mapping_kind="agent_configuration_reference" if agent else "model_configuration_reference",
        mapping_confidence="low" if agent else "medium",
        mapping_note=("Exact served-model reference only; product harness and quota-measurement effort are unverified. "
                      "Not a benchmark measurement of this subscription or API channel." if agent else
                      "Exact served-model reference; quota-measurement effort is unverified."),
        quota_effort_matched=None,
    )


def score_fields(record):
    keys = ("configuration_id", "variant", "score", "agent_harness", "reasoning_effort", "service_mode",
            "score_low", "score_high", "mean_cost_usd_per_task", "median_cost_usd_per_task", "source")
    fields = {k: record[k] if record else None for k in keys}
    fields.update(mapping(record) if record else {k: None for k in
                  ("mapping_kind", "mapping_confidence", "mapping_note", "quota_effort_matched")})
    return fields
