import random
import unittest

import speedtest

VOCAB = (
    "river stone lamp harbour winter bread copper garden lantern meadow orchard pebble timber valley "
    "candle ribbon thunder market beacon saddle anchor mirror quarry violet compass marble feather"
).split()


def prose(words: int, seed: int) -> str:
    rng = random.Random(seed)
    out, sentence = [], []
    for _ in range(words):
        sentence.append(rng.choice(VOCAB))
        if len(sentence) == 12:
            out.append(" ".join(sentence).capitalize() + ".")
            sentence = []
    if sentence:
        out.append(" ".join(sentence).capitalize() + ".")
    return " ".join(out)


def new_state(sizes, reps=2):
    return {
        "plan": speedtest.build_plan(sizes, reps, "seed"),
        "current": 0,
        "trials": [],
        "shingles": [],
        "issued_at": 0.0,
    }


class SpeedtestTest(unittest.TestCase):
    def test_plan_has_warmup_then_shuffled_sizes(self):
        plan = speedtest.build_plan([0, 150, 500], 2, "x")
        self.assertTrue(plan[0]["warmup"])
        self.assertEqual(sorted(t["target_words"] for t in plan[1:]), [0, 0, 150, 150, 500, 500])
        self.assertTrue(all(t["topic"] for t in plan[1:] if t["target_words"]))

    def test_recovers_simulated_speed_and_overhead(self):
        state = new_state([0, 150, 500, 1000])
        tok_per_s, overhead = 60.0, 3.0
        for i, trial in enumerate(state["plan"]):
            payload = "ok" if trial["target_words"] == 0 else prose(trial["target_words"], i)
            tokens = speedtest.estimate_tokens(payload)
            state["issued_at"] = 100.0 * i
            speedtest.record_trial(state, payload, 100.0 * i + overhead + tokens / tok_per_s)
        summary = speedtest.analyse(state["trials"])
        self.assertEqual(summary["invalid_trials"], 0)
        self.assertAlmostEqual(summary["output_tok_per_s"], tok_per_s, delta=0.5)
        self.assertAlmostEqual(summary["fixed_overhead_s"], overhead, delta=0.05)
        self.assertGreater(summary["r2"], 0.999)

    def test_rejects_wrong_length_and_reused_text(self):
        state = new_state([150], reps=3)
        speedtest.record_trial(state, "ok", 1.0)
        text = prose(150, 1)
        self.assertTrue(speedtest.record_trial(state, text, 2.0)["valid"])
        self.assertIn("reuses", speedtest.record_trial(state, text, 3.0)["reason"])
        self.assertIn("outside", speedtest.record_trial(state, prose(20, 2), 4.0)["reason"])

    def test_rejects_long_reply_on_minimal_turn(self):
        state = new_state([0], reps=1)
        speedtest.record_trial(state, "ok", 1.0)
        self.assertFalse(speedtest.record_trial(state, prose(40, 3), 2.0)["valid"])

    def test_no_fit_without_distinct_sizes(self):
        state = new_state([150], reps=3)
        for i in range(4):
            speedtest.record_trial(state, "ok" if i == 0 else prose(150, 10 + i), 5.0)
        self.assertIsNone(speedtest.analyse(state["trials"])["output_tok_per_s"])

    def test_heuristic_token_estimate_is_plausible(self):
        text = "The quick brown fox jumps over the lazy dog, again and again."
        self.assertTrue(12 <= speedtest.estimate_tokens(text) <= 16)


if __name__ == "__main__":
    unittest.main()
