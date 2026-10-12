"use strict";

/* Theme: auto (system) by default; manual choice persists in localStorage.
   Runs as a deferred script, before DOMContentLoaded. */
(function () {
  var KEY = "wgf-theme";
  var MODES = ["auto", "light", "dark"];
  var root = document.documentElement;

  function stored() {
    try {
      var value = localStorage.getItem(KEY);
      return MODES.indexOf(value) !== -1 ? value : "auto";
    } catch (err) {
      return "auto";
    }
  }

  function apply(mode) {
    if (mode === "dark" || mode === "light") {
      root.setAttribute("data-theme", mode);
    } else {
      root.removeAttribute("data-theme");
    }
    root.setAttribute("data-theme-mode", mode);
  }

  function label(mode) {
    if (mode === "auto") return "Theme: system default. Switch to light mode.";
    if (mode === "light") return "Theme: light. Switch to dark mode.";
    return "Theme: dark. Switch to system default.";
  }

  var mode = stored();
  apply(mode);

  function wireToggle() {
    var toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-label", label(mode));
    toggle.setAttribute("title", label(mode));
    toggle.addEventListener("click", function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      try {
        if (mode === "auto") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, mode);
      } catch (err) { /* storage unavailable; theme lasts for this page only */ }
      apply(mode);
      toggle.setAttribute("aria-label", label(mode));
      toggle.setAttribute("title", label(mode));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireToggle);
  } else {
    wireToggle();
  }
})();

/* Header hairline once the page scrolls. */
(function () {
  var header = document.querySelector(".site-header");
  if (!header) return;
  function onScroll() {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
})();

/* Scroll-in reveals. Elements stay fully visible without JS and under
   prefers-reduced-motion; the hiding class is only added by JS. */
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches || !("IntersectionObserver" in window)) return;

  var items = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
  if (!items.length) return;

  document.documentElement.classList.add("js-reveal");

  items.forEach(function (el) {
    var group = el.parentElement;
    var siblings = group ? Array.prototype.slice.call(group.querySelectorAll(":scope > [data-reveal]")) : [el];
    var index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = Math.min(index * 80, 400) + "ms";
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );

  items.forEach(function (el) {
    observer.observe(el);
  });
})();
