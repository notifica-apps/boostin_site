/**
 * Contactformulier in een popup.
 *
 * Vervangt de oude pipedrive-popup.js. Die laadde een Pipedrive Web Form, maar
 * die formulieren bestaan niet meer -- beide URL's gaven een 404, waardoor elke
 * CTA op de site dood was. Nu staat het formulier in eigen beheer en gaat het
 * naar /api/contact-submit.
 *
 * Knoppen openen de popup met data-contact-form, en data-title bepaalt het
 * onderwerp dat in Pipedrive terechtkomt.
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/contact-submit";
  var overlay = null;

  function build() {
    var el = document.createElement("div");
    el.className = "cf-overlay";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Contactformulier");
    el.innerHTML = [
      '<div class="cf-panel">',
      '  <button type="button" class="cf-close" aria-label="Sluiten">&times;</button>',
      '  <div class="cf-body">',
      '    <p class="cf-kicker"></p>',
      '    <h2 class="cf-title">Plan een gesprek</h2>',
      '    <p class="cf-intro">Laat je gegevens achter, dan nemen we binnen één werkdag contact op.</p>',
      '    <form class="cf-form" novalidate>',
      '      <div class="cf-row">',
      '        <label>Naam *<input type="text" name="name" autocomplete="name" required></label>',
      '        <label>Bedrijf<input type="text" name="company" autocomplete="organization"></label>',
      '      </div>',
      '      <div class="cf-row">',
      '        <label>E-mail *<input type="email" name="email" autocomplete="email" required></label>',
      '        <label>Telefoon<input type="tel" name="phone" autocomplete="tel"></label>',
      '      </div>',
      '      <label>Waar gaat het over?<textarea name="message" rows="4"></textarea></label>',
      // honeypot: onzichtbaar voor mensen, aantrekkelijk voor bots
      '      <div class="cf-trap" aria-hidden="true"><label>Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>',
      '      <p class="cf-error" role="alert" hidden></p>',
      '      <button type="submit" class="btn btn-primary cf-submit">Verstuur</button>',
      '      <p class="cf-note">We gebruiken je gegevens alleen om te reageren op deze aanvraag.</p>',
      '    </form>',
      '    <div class="cf-done" hidden>',
      '      <div class="cf-check" aria-hidden="true">',
      '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      '      </div>',
      '      <h3>Dank je, we hebben je aanvraag binnen</h3>',
      '      <p>Je krijgt een bevestiging per e-mail. We nemen binnen één werkdag contact op.</p>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("");
    document.body.appendChild(el);
    return el;
  }

  function open(title) {
    if (!overlay) overlay = build();

    var kicker = overlay.querySelector(".cf-kicker");
    kicker.textContent = title || "";
    kicker.hidden = !title;

    overlay.querySelector(".cf-form").hidden = false;
    overlay.querySelector(".cf-done").hidden = true;
    overlay.querySelector(".cf-error").hidden = true;
    overlay.querySelector(".cf-form").dataset.title = title || "";

    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";

    var first = overlay.querySelector('input[name="name"]');
    if (first) first.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function fail(form, text) {
    var box = form.querySelector(".cf-error");
    box.textContent = text;
    box.hidden = false;
  }

  async function submit(form) {
    var button = form.querySelector(".cf-submit");
    var data = new FormData(form);

    var payload = {
      name: (data.get("name") || "").trim(),
      email: (data.get("email") || "").trim(),
      phone: (data.get("phone") || "").trim(),
      company: (data.get("company") || "").trim(),
      message: (data.get("message") || "").trim(),
      website: (data.get("website") || "").trim(),
      title: form.dataset.title || "",
      pageUrl: window.location.href,
    };

    if (!payload.name || !payload.email) {
      fail(form, "Vul je naam en e-mailadres in.");
      return;
    }

    form.querySelector(".cf-error").hidden = true;
    button.disabled = true;
    button.textContent = "Versturen…";

    try {
      var resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var result = await resp.json().catch(function () {
        return {};
      });

      if (!resp.ok || !result.success) {
        throw new Error(result.error || "Er ging iets mis.");
      }

      form.hidden = true;
      form.parentNode.querySelector(".cf-done").hidden = false;
    } catch (err) {
      fail(
        form,
        String(err.message || err) ||
          "We konden je aanvraag niet versturen. Mail ons op info@boostin-consultancy.nl."
      );
    } finally {
      button.disabled = false;
      button.textContent = "Verstuur";
    }
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-contact-form]");
    if (trigger) {
      e.preventDefault();
      open(trigger.getAttribute("data-title") || "");
      return;
    }
    if (e.target.closest(".cf-close")) close();
    if (e.target.classList && e.target.classList.contains("cf-overlay")) close();
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest(".cf-form, .cf-inline");
    if (!form) return;
    e.preventDefault();
    submit(form);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
