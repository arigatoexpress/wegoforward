import { REPLY_WINDOW } from "../../assets/contact-config.js";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const LIMITS = { name: 80, shop: 120, email: 120, question: 2000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const NOT_READY = "This form is not ready to send yet. Please use LinkedIn in the meantime.";
const SEND_FAILED = "I could not send that note. Please try again, or message me on LinkedIn.";
const CHECK_FAILED = "The spam check did not pass. Please try again.";
const CHECK_MISSING = "The spam check did not finish. Wait for it, then send again.";
const CHECK_UNAVAILABLE = "The spam check could not be completed. Please try again.";
const BAD_ORIGIN = "That submission did not come from this site. Use the form on the contact page.";
const UNREADABLE = "That submission could not be read. Please try the form again.";

function wantsJson(request) {
  return (request.headers.get("accept") || "").includes("application/json");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderPage(heading, message) {
  const title = `${heading} | WeGoForward`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<main id="main">
<section class="page-hero">
  <div class="container">
    <h1>${escapeHtml(heading)}</h1>
    <p class="lede">${escapeHtml(message)}</p>
    <div class="actions">
      <a class="btn btn-primary" href="/contact">Back to the form</a>
      <a class="btn btn-ghost" href="https://www.linkedin.com/in/arispector/">Message Ari on LinkedIn</a>
    </div>
  </div>
</section>
</main>
</body>
</html>`;
}

function reply(request, status, payload) {
  const headers = { "cache-control": "no-store" };
  if (wantsJson(request)) {
    return Response.json(payload, { status, headers });
  }
  const heading = payload.ok ? "Got it" : "That note did not send";
  const message = payload.ok ? `Got it. I have your note. ${REPLY_WINDOW}` : payload.error;
  headers["content-type"] = "text/html; charset=utf-8";
  headers["content-security-policy"] =
    "default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
  return new Response(renderPage(heading, message), { status, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function cleanLine(value, max) {
  if (typeof value !== "string") return "";
  if (CONTROL.test(value) || /[\r\n]/.test(value)) return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanQuestion(value) {
  if (typeof value !== "string") return "";
  if (CONTROL.test(value)) return "";
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().slice(0, LIMITS.question);
}

function validEmail(value) {
  return value.length <= LIMITS.email && EMAIL.test(value) && !value.includes("..");
}

function ready(env) {
  if (!env || typeof env.EMAIL?.send !== "function") return false;
  const to = typeof env.OUTREACH_TO === "string" ? env.OUTREACH_TO.trim() : "";
  const from = typeof env.OUTREACH_FROM === "string" ? env.OUTREACH_FROM.trim() : "";
  const secret = typeof env.TURNSTILE_SECRET_KEY === "string" ? env.TURNSTILE_SECRET_KEY.trim() : "";
  if (!secret || !validEmail(to) || !validEmail(from)) return false;
  return { to, from, secret };
}

export async function handleContact(request, env, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  let form;
  try {
    form = await request.formData();
  } catch {
    return reply(request, 400, { ok: false, error: UNREADABLE });
  }

  if (!sameOrigin(request)) {
    return reply(request, 403, { ok: false, error: BAD_ORIGIN });
  }

  const honeypot = typeof form.get("company_website") === "string" ? form.get("company_website").trim() : "";
  if (honeypot) {
    return reply(request, 200, { ok: true });
  }

  const name = cleanLine(form.get("name"), LIMITS.name);
  const shop = cleanLine(form.get("shop"), LIMITS.shop);
  const email = cleanLine(form.get("email"), LIMITS.email);
  const question = cleanQuestion(form.get("question"));
  const fields = {};
  if (!name) fields.name = "Add your name.";
  if (!shop) fields.shop = "Add the shop name.";
  if (!validEmail(email)) fields.email = "That email does not look usable. Check it and try again.";
  if (question.length < 10) fields.question = "Add a little more about the question so I know how to help.";
  if (Object.keys(fields).length) {
    return reply(request, 400, {
      ok: false,
      error: "Add your name, the shop name, your email, and your question.",
      fields,
    });
  }

  const config = ready(env);
  if (!config) {
    return reply(request, 503, { ok: false, error: NOT_READY });
  }

  const token = cleanLine(form.get("cf-turnstile-response"), 2048);
  if (!token) {
    return reply(request, 400, { ok: false, error: CHECK_MISSING });
  }

  let verified = false;
  try {
    const body = new URLSearchParams();
    body.set("secret", config.secret);
    body.set("response", token);
    const result = await fetchImpl(SITEVERIFY, { method: "POST", body });
    const data = await result.json();
    verified = result.ok && data && data.success === true;
  } catch {
    return reply(request, 400, { ok: false, error: CHECK_UNAVAILABLE });
  }
  if (!verified) {
    return reply(request, 400, { ok: false, error: CHECK_FAILED });
  }

  const text = [
    "New question from the WeGoForward contact form.",
    "",
    `Name: ${name}`,
    `Shop: ${shop}`,
    `Email: ${email}`,
    "",
    "Question:",
    question,
    "",
    "Reply to the sender. Nothing was sent to the shop.",
  ].join("\n");

  try {
    await env.EMAIL.send({
      to: config.to,
      from: { email: config.from, name: "WeGoForward form" },
      replyTo: email,
      subject: `Question from ${shop}`.slice(0, 120),
      text,
    });
  } catch {
    return reply(request, 502, { ok: false, error: SEND_FAILED });
  }

  return reply(request, 200, { ok: true });
}

export async function onRequestPost(context) {
  return handleContact(context.request, context.env);
}
