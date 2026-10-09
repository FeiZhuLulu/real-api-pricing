import test from "node:test";
import assert from "node:assert/strict";
import { copyText } from "./clipboard";

test("clipboard copy reports success only after write completes", async () => {
  let received = "";
  assert.equal(await copyText("prompt", { writeText: async (text) => { received = text; } }), true);
  assert.equal(received, "prompt");
});
test("clipboard denial and missing API are recoverable", async () => {
  assert.equal(await copyText("prompt", { writeText: async () => { throw new Error("denied"); } }), false);
  assert.equal(await copyText("prompt"), false);
});
