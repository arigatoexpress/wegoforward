"use strict";

function clean(value) {
  if (typeof value !== "string") throw new Error("text required");
  return value.split(/\s+/).join(" ").slice(0, 240);
}

function draft(payload) {
  const allowed = payload.allowed_fields || ["enquiry"];
  if (!Array.isArray(allowed) || allowed.some((item) => typeof item !== "string")) {
    throw new Error("allowed_fields");
  }
  const used = allowed.filter((key) => key in payload && key !== "allowed_fields");
  const enquiry = used.includes("enquiry") ? clean(payload.enquiry) : "";
  return {
    kind: "draft",
    reply: enquiry ? `Thanks. We have your note: ${enquiry}` : "",
    fields_used: used,
    sent: false,
  };
}

module.exports = { draft };

if (require.main === module) {
  const result = draft({
    enquiry: "Can you look at the leak?",
    phone: "555-0100",
    allowed_fields: ["enquiry"],
  });
  if (result.sent !== false || result.fields_used.includes("phone") || result.reply.includes("555-0100")) {
    throw new Error("exercise failed");
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
