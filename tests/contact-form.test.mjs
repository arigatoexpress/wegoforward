import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { REPLY_WINDOW, REPLY_WINDOW_STATUS } from "../assets/contact-config.js";
import { handleContact } from "../functions/api/contact.js";
import { publicContactConfig } from "../functions/api/contact-config.js";

const PLACEHOLDER = "A reply window is not published on this page yet.";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function env(overrides = {}) {
  const sent = [];
  return {
    sent,
    OUTREACH_TO: "inbox@shop.test",
    OUTREACH_FROM: "forms@shop.test",
    TURNSTILE_SECRET_KEY: "turnstile-secret-for-test",
    TURNSTILE_SITE_KEY: "site-key-for-test",
    EMAIL: {
      async send(message) {
        sent.push(message);
        return { messageId: "m1" };
      },
    },
    ...overrides,
  };
}

function post(fields, { origin = "https://wegoforward.app", accept = "application/json" } = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new Request("https://wegoforward.app/api/contact", {
    method: "POST",
    headers: { origin, accept },
    body,
  });
}

const valid = {
  name: "Ada",
  shop: "Ridge Repair",
  email: "ada@shop.test",
  question: "Can you set up answers for hours and what we fix?",
  "cf-turnstile-response": "token-ok",
};

function fetchOk() {
  const impl = async (url, init) => {
    impl.last = { url: String(url), body: String(init.body) };
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  return impl;
}

test("marketing pages allow Turnstile and keep Labs out of the primary nav", () => {
  const headers = read("_headers");
  const policy = "script-src 'self' https://static.cloudflareinsights.com https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://cloudflareinsights.com https://challenges.cloudflare.com";
  assert.equal(headers.split(policy).length - 1, 11);
  assert.match(read("assets/contact-form.js"), /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(read("functions/api/contact.js"), /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.equal(read("llms.txt").includes("only inbox"), false);
  assert.match(read("404.html"), /That page is not here/);
  assert.match(read("404.html"), /href="\/contact"/);
  for (const name of ["index.html", "contact.html", "labs.html", "404.html"]) {
    const page = read(name);
    const nav = page.slice(page.indexOf('aria-label="Primary"'), page.indexOf("</nav>"));
    assert.equal(nav.includes('href="/labs"'), false, name);
  }
});

test("reply window is one flagged placeholder until the owner sets it", () => {
  const config = read("assets/contact-config.js");
  const page = read("contact.html");
  assert.match(config, /OWNER CONFIG/);
  assert.match(config, /PLACEHOLDER/);
  assert.equal(REPLY_WINDOW_STATUS, "placeholder");
  assert.equal(REPLY_WINDOW, PLACEHOLDER);
  assert.match(page, new RegExp(`id="reply-window"[^>]*>${PLACEHOLDER}<`));
  assert.match(page, /data-reply-window="placeholder"/);
  assert.equal(page.includes("within two business days"), false);
  assert.equal(config.includes("within two business days"), false);
});

test("contact page keeps LinkedIn and does not call it the only inbox", () => {
  const page = read("contact.html");
  assert.match(page, /https:\/\/www\.linkedin\.com\/in\/arispector\//);
  assert.equal(page.toLowerCase().includes("only inbox"), false);
  assert.match(page, /id="lead-form"/);
  assert.match(page, /name="name"/);
  assert.match(page, /name="shop"/);
  assert.match(page, /name="email"/);
  assert.match(page, /name="question"/);
  assert.match(page, /name="company_website"/);
  assert.match(page, /inert/);
  for (const id of ["name", "shop", "email", "question"]) {
    assert.match(page, new RegExp(`<label for="${id}">`));
  }
});

test("home shows the fictional flow, who it is for, a short FAQ, and only the two prices", () => {
  const page = read("index.html");
  assert.match(page, /Fictional demo/);
  assert.match(page, /id="who"/);
  assert.match(page, /Who it's for/);
  assert.match(page, /id="faq"/);
  assert.match(page, /\$495 setup \+ \$99\/month/);
  assert.match(page, /\$995 setup \+ \$249\/month/);
  for (const draft of ["$1,495", "$399", "$149/month", "Launch Lite", "Protect Checkup"]) {
    assert.equal(page.includes(draft), false, draft);
  }
  const nav = page.slice(page.indexOf('aria-label="Primary"'), page.indexOf("</nav>"));
  assert.equal(nav.includes("/labs"), false);
  assert.match(page, /<footer[\s\S]*href="\/labs"/);
});

test("handler source reads destination and secret from the environment", () => {
  const src = read("functions/api/contact.js");
  const docs = read("functions/README.md");
  assert.equal(src.includes("outreach@"), false);
  assert.equal(src.includes("turnstile-secret"), false);
  assert.match(src, /env\.OUTREACH_TO/);
  assert.match(src, /env\.OUTREACH_FROM/);
  assert.match(src, /env\.TURNSTILE_SECRET_KEY/);
  assert.match(src, /env\.EMAIL/);
  for (const name of ["EMAIL", "OUTREACH_TO", "OUTREACH_FROM", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) {
    assert.ok(docs.includes(name), name);
  }
});

test("public config returns only the site key", () => {
  const body = publicContactConfig({
    TURNSTILE_SITE_KEY: " site-key ",
    TURNSTILE_SECRET_KEY: "super-secret",
    OUTREACH_TO: "inbox@shop.test",
  });
  assert.deepEqual(body, { siteKey: "site-key" });
  assert.equal(JSON.stringify(body).includes("super-secret"), false);
  assert.deepEqual(publicContactConfig({}), { siteKey: "" });
});

test("sends to the configured inbox after Turnstile passes", async () => {
  const box = env();
  const fetch = fetchOk();
  const response = await handleContact(post(valid), box, { fetch });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(box.sent.length, 1);
  assert.equal(box.sent[0].to, "inbox@shop.test");
  assert.equal(box.sent[0].from.email, "forms@shop.test");
  assert.equal(box.sent[0].replyTo, "ada@shop.test");
  assert.match(box.sent[0].text, /Ridge Repair/);
  assert.match(box.sent[0].text, /hours and what we fix/);
  assert.equal(box.sent[0].text.includes("token-ok"), false);
  assert.equal(box.sent[0].text.includes("turnstile-secret"), false);
  assert.equal(box.sent[0].text.includes("company_website"), false);
  assert.equal(fetch.last.url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.match(fetch.last.body, /secret=turnstile-secret-for-test/);
  assert.match(fetch.last.body, /response=token-ok/);
});

test("honeypot pretends success and does not send", async () => {
  const box = env();
  let called = false;
  const response = await handleContact(
    post({ ...valid, company_website: "https://spam.test" }),
    box,
    { fetch: async () => { called = true; return new Response("{}"); } },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(box.sent.length, 0);
  assert.equal(called, false);
});

test("missing and bad fields are friendly", async () => {
  const box = env();
  const response = await handleContact(
    post({ name: "Ada", shop: " ", email: "not-an-email", question: "short", "cf-turnstile-response": "t" }),
    box,
    { fetch: async () => { throw new Error("should not verify"); } },
  );
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /name, the shop name, your email, and your question/);
  assert.match(data.fields.shop, /shop name/);
  assert.match(data.fields.email, /does not look usable/);
  assert.match(data.fields.question, /a little more/);
  assert.equal(box.sent.length, 0);
});

test("missing Turnstile token does not send", async () => {
  const box = env();
  const fields = { ...valid };
  delete fields["cf-turnstile-response"];
  const response = await handleContact(post(fields), box, { fetch: async () => { throw new Error("no"); } });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /spam check did not finish/);
  assert.equal(box.sent.length, 0);
});

test("failed Turnstile does not send", async () => {
  const box = env();
  const response = await handleContact(post(valid), box, {
    fetch: async () => new Response(JSON.stringify({ success: false }), { status: 200 }),
  });
  const data = await response.json();
  assert.equal(response.status, 400);
  assert.match(data.error, /did not pass/);
  assert.equal(box.sent.length, 0);
});

test("a send failure stays friendly and hides the provider error", async () => {
  const box = env({
    EMAIL: { async send() { throw Object.assign(new Error("smtp exploded secret"), { code: "E_DELIVERY_FAILED" }); } },
  });
  const response = await handleContact(post(valid), box, { fetch: fetchOk() });
  const data = await response.json();
  assert.equal(response.status, 502);
  assert.match(data.error, /could not send/);
  assert.equal(JSON.stringify(data).includes("smtp"), false);
  assert.equal(JSON.stringify(data).includes("secret"), false);
});

test("missing bindings say the form is not ready", async () => {
  for (const drop of ["OUTREACH_TO", "OUTREACH_FROM", "TURNSTILE_SECRET_KEY", "EMAIL"]) {
    const box = env();
    delete box[drop];
    const response = await handleContact(post(valid), box, { fetch: fetchOk() });
    const data = await response.json();
    assert.equal(response.status, 503, drop);
    assert.match(data.error, /not ready to send/);
    assert.equal(data.error.includes("inbox@shop.test"), false);
  }
});

test("a different destination in the payload cannot redirect the mail", async () => {
  const box = env();
  const response = await handleContact(
    post({ ...valid, to: "thief@shop.test", OUTREACH_TO: "thief@shop.test" }),
    box,
    { fetch: fetchOk() },
  );
  assert.equal(response.status, 200);
  assert.equal(box.sent[0].to, "inbox@shop.test");
});

test("another origin is rejected", async () => {
  const box = env();
  const response = await handleContact(post(valid, { origin: "https://evil.test" }), box, { fetch: fetchOk() });
  assert.equal(response.status, 403);
  assert.match((await response.json()).error, /did not come from this site/);
  assert.equal(box.sent.length, 0);
});

test("a browser form post gets an HTML page", async () => {
  const box = env();
  const response = await handleContact(post(valid, { accept: "text/html" }), box, { fetch: fetchOk() });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(html, /Got it/);
  assert.match(html, new RegExp(PLACEHOLDER.replace(/[.]/g, "\\.")));
  assert.match(html, /linkedin\.com\/in\/arispector/);
  assert.equal(html.includes("<script"), false);
});
