"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { draft } = require("./exercise.cjs");

test("drops a field that was not allowed and does not send", () => {
  const result = draft({
    enquiry: "Can you look at the leak?",
    phone: "555-0100",
    allowed_fields: ["enquiry"],
  });
  assert.equal(result.sent, false);
  assert.deepEqual(result.fields_used, ["enquiry"]);
  assert.equal(result.reply.includes("555-0100"), false);
  assert.match(result.reply, /leak/);
});

test("sent cannot be flipped by the caller payload", () => {
  const result = draft({ enquiry: "hi", sent: true, allowed_fields: ["enquiry", "sent"] });
  assert.equal(result.sent, false);
});
