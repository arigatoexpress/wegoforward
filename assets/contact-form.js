import { REPLY_WINDOW } from "./contact-config.js";

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function onReady(run) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
}

function theme() {
  const picked = document.documentElement.getAttribute("data-theme");
  if (picked === "light" || picked === "dark") return picked;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

onReady(function () {
  const slot = document.getElementById("reply-window");
  if (slot) slot.textContent = REPLY_WINDOW;

  const form = document.getElementById("lead-form");
  if (!form) return;
  const status = document.getElementById("form-status");
  const submit = form.querySelector("[type=submit]");
  let widgetId = null;

  function say(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function clearFieldErrors() {
    form.querySelectorAll("[data-field-error]").forEach(function (el) {
      el.textContent = "";
    });
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.removeAttribute) el.removeAttribute("aria-invalid");
    });
  }

  function showFields(fields) {
    if (!fields) return;
    Object.keys(fields).forEach(function (name) {
      const input = form.elements.namedItem(name);
      const error = document.getElementById(name + "-error");
      if (input && input.setAttribute) input.setAttribute("aria-invalid", "true");
      if (error) error.textContent = fields[name];
    });
  }

  function block(message) {
    if (submit) submit.disabled = true;
    say(message, true);
  }

  fetch("/api/contact-config", { headers: { Accept: "application/json" } })
    .then(function (res) {
      if (!res.ok) throw new Error("config");
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.siteKey) throw new Error("nokey");
      return new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = TURNSTILE_SRC;
        script.async = true;
        script.onload = function () { resolve(data.siteKey); };
        script.onerror = function () { reject(new Error("script")); };
        document.head.appendChild(script);
      });
    })
    .then(function (siteKey) {
      if (!window.turnstile) throw new Error("script");
      widgetId = window.turnstile.render("#turnstile", { sitekey: siteKey, theme: theme() });
    })
    .catch(function () {
      block("The spam check is not set up yet, so this form cannot send. Please use the LinkedIn link instead.");
    });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (submit && submit.disabled) return;
    clearFieldErrors();
    say("Sending your question.", false);
    if (submit) submit.disabled = true;
    const body = new FormData(form);
    if (window.turnstile && !body.get("cf-turnstile-response")) {
      const token = window.turnstile.getResponse(widgetId);
      if (token) body.set("cf-turnstile-response", token);
    }
    fetch("/api/contact", {
      method: "POST",
      body: body,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(function (res) {
        return res.json().then(
          function (data) { return { ok: res.ok, data: data }; },
          function () {
            return { ok: false, data: { ok: false, error: "Something went wrong reading the reply. Please try again, or use LinkedIn." } };
          }
        );
      })
      .then(function (result) {
        if (result.data && result.data.ok) {
          form.hidden = true;
          say("Got it. I have your note. " + REPLY_WINDOW, false);
          if (status) status.focus();
          return;
        }
        const message = (result.data && result.data.error) || "I could not send that note. Please try again, or message me on LinkedIn.";
        say(message, true);
        showFields(result.data && result.data.fields);
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        if (submit) submit.disabled = false;
      })
      .catch(function () {
        say("I could not send that note. Please try again, or message me on LinkedIn.", true);
        if (submit) submit.disabled = false;
      });
  });
});
