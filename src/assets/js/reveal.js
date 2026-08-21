/**
 * Inladen bij scrollen.
 *
 * De verborgen begintoestand staat in main.css, niet hier. Zou dit script de
 * elementen pas na het eerste tekenen verbergen, dan flikkert elke pageload.
 * Dit script doet daarom maar een ding: is-visible zetten zodra iets in beeld
 * komt. Gaat er onverhoopt iets mis, dan wordt alles alsnog zichtbaar gemaakt.
 *
 * De selectorlijst hoort gelijk te blijven met die in main.css.
 */
(function () {
  "use strict";

  var SELECTORS = [
    ".np-head", ".np-card", ".np-domain", ".np-lane", ".np-phase", ".np-panel",
    ".np-quote", ".np-cta", ".np-logo", ".np-stat", ".np-testimonial",
    ".np-chain", ".np-media", ".np-role", ".np-person", ".np-compare",
    ".np-hero-grid > div",
    ".card", ".methode-card", ".klant-logo", ".section-header", ".two-col > div"
  ].join(",");

  // Elementen die als groep verschijnen, lopen met een klein verschil in
  // timing binnen, zodat een rij kaarten inloopt in plaats van in een klap
  // verschijnt.
  var STAGGER_PARENTS = [
    ".np-grid", ".np-lanes", ".np-phases", ".np-logos", ".np-stats-grid",
    ".np-roles", ".np-split", ".np-hero-grid", ".grid", ".methode-grid",
    ".klanten-grid"
  ].join(",");

  var STAGGER_MS = 80;
  var MAX_STAGGER = 5; // niet verder oplopen, anders wacht de laatste te lang

  function showAll(nodes) {
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.add("is-visible");
  }

  function init() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(SELECTORS));
    if (!nodes.length) return;

    try {
      if (!("IntersectionObserver" in window)) {
        showAll(nodes);
        return;
      }

      // Ontdubbelen: zit een element in een blok dat zelf al meedoet, dan
      // animeert dat blok het geheel al.
      nodes = nodes.filter(function (el) {
        return !el.parentNode || !el.parentNode.closest(SELECTORS);
      });

      nodes.forEach(function (el) {
        var group = el.closest(STAGGER_PARENTS);
        if (!group) return;
        var i = Array.prototype.slice.call(group.children).indexOf(el);
        if (i > 0) {
          el.style.setProperty(
            "--reveal-delay",
            Math.min(i, MAX_STAGGER) * STAGGER_MS + "ms"
          );
        }
      });

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
      );

      nodes.forEach(function (el) {
        observer.observe(el);
      });
    } catch (e) {
      // liever alles zichtbaar dan een lege pagina
      showAll(document.querySelectorAll(SELECTORS));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
