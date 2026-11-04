// Public Turnstile site key for the contact page. The secret never leaves the server.

export function publicContactConfig(env) {
  const raw = env && typeof env.TURNSTILE_SITE_KEY === "string" ? env.TURNSTILE_SITE_KEY.trim() : "";
  if (!raw || raw.length > 200 || /[\r\n\u0000]/.test(raw)) return { siteKey: "" };
  return { siteKey: raw };
}

export async function onRequestGet(context) {
  return Response.json(publicContactConfig(context.env), {
    headers: { "cache-control": "no-store" },
  });
}
