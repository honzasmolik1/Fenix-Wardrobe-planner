import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidClientEmail } from "@/store/store";

test("a quote email has to be a real address", () => {
  for (const email of [
    "jan@fenix.com.au",
    "jan.smolik@fenix-wardrobes.com",
    "  jan@fenix.com.au  ",
  ]) {
    assert.ok(isValidClientEmail(email), `${email} should be accepted`);
  }

  for (const email of [
    "",
    "   ",
    "jan",
    "jan@",
    "@fenix.com.au",
    "jan@fenix",
    "jan @fenix.com.au",
    "jan@fenix.c",
  ]) {
    assert.ok(!isValidClientEmail(email), `${email} should be rejected`);
  }
});
