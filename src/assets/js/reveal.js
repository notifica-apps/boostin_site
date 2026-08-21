/**
 * Inladen bij scrollen.
 *
 * Elementen worden hier gemarkeerd in plaats van in de templates, zodat de
 * markup schoon blijft.
 *
 * Belangrijk: dit script draait na het eerste tekenen van de pagina. Wat op dat
 * moment al in beeld staat, laten we dus ongemoeid -- zou je dat alsnog
 * verbergen om het daarna in te faden, dan zie je bij elke pageload een
 * flikkering. Alleen wat buiten het scherm staat wordt verborgen en verschijnt
 * bij het scrollen. Draait dit script niet, dan is alles simpelweg zichtbaar.
 */
(function () {
  "use strict";

  var SELECTORS = [
    // componenten van de nieuwe pagina's
    ".np-head",
    ".np-card",
    ".np-domain",
    ".np-lane",
    ".np-phase",
    ".np-panel",
    ".np-quote",
    ".np-cta",
    ".np-logo",
    ".np-stat",
    ".np-testimonial",
    ".np-chain",
    ".np-media",
    ".np-role",
    ".np-person",
    ".np-compare",
    // componenten van de oudere pagina's
    ".card",
    ".methode-card",
    ".klant-logo",
    ".section-header",
    ".two-col > div"
  ].join(",");

  // Elementen die als groep verschijnen, krijgen een klein verschil in timing
  var STAGGER_PARENTS = [
    ".np-grid",
    ".np-lanes",
    ".np-phases",
    ".np-logos",
    ".np-stats-grid",
    ".np-roles",
    ".np-split",
    ".grid",
    ".methode-grid",
    ".klanten-grid"
  ].join(",");

  var STAGGER_MS = 70;
  var MAX_STAGGER = 5; // niet verder oplopen, anders wacht de laatste te lang

  var root = document.documentElement;
  var supported =
    "IntersectionObserver" in window && typeof document.querySelectorAll === "function";

  if (!supported) return;

  function show(el) {
    el.classList.add("is-visible");
  }

  function init() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(SELECTORS));
    if (!nodes.length) return;

    root.classList.add("reveal-ready");

    var viewport = window.innerHeight || document.documentElement.clientHeight;

    // Alleen wat onder de eerste schermvulling staat doet mee. Ontdubbelen in
    // documentvolgorde: staat er al een gemarkeerde voorouder, dan animeert die
    // het geheel al en hoeft het kind niet apart.
    nodes = nodes.filter(function (el) {
      if (el.parentNode && el.parentNode.closest("[data-reveal]")) return false;
      if (el.getBoundingClientRect().top < viewport) return false;
      el.setAttribute("data-reveal", "");
      return true;
    });

    if (!nodes.length) return;

    nodes.forEach(function (el) {
      var group = el.closest(STAGGER_PARENTS);
      if (group) {
        var siblings = Array.prototype.slice.call(group.children);
        var i = siblings.indexOf(el);
        if (i > 0) {
          el.style.setProperty("--reveal-delay", Math.min(i, MAX_STAGGER) * STAGGER_MS + "ms");
        }
      }
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          show(entry.target);
          observer.unobserve(entry.target);
        });
      },
      // iets voordat het element helemaal in beeld is starten, en al reageren op
      // een klein stukje zichtbaarheid: anders blijven brede blokken achter
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    nodes.forEach(function (el) {
      observer.observe(el);
    });

    // noodrem: mocht de observer om welke reden dan ook niet vuren, dan staat
    // er na twee seconden alsnog niets verborgen
    window.setTimeout(function () {
      nodes.forEach(show);
    }, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
