/**
 * Cookie consent voor Boostin Consultancy.
 *
 * AVG-conform: er worden pas cookies geplaatst en pas gegevens gemeten nadat
 * de bezoeker daar toestemming voor heeft gegeven.
 *
 * Google Analytics werkt daarbij anders dan de rest. Die tag staat via Consent
 * Mode v2 in de head van base.njk en laadt dus altijd -- anders kan Google hem
 * niet vinden en faalt de tagcontrole in GA4. Hij staat daar standaard op
 * "denied": geen cookies, geen identifiers, alleen een cookieloze ping. Dit
 * bestand zet hem bij "Accepteren" om naar "granted". Clarity en LinkedIn
 * worden wel gewoon pas na toestemming ingeladen.
 *
 * De meet-ID's staan NIET in dit bestand maar in src/_data/site.json onder
 * "analytics". Het layout-bestand zet die als window.BOOSTIN_CONSENT_CONFIG in
 * de pagina. Zo staat er geen ID van een ander bedrijf in de Boostin-code en
 * hoef je voor een nieuwe tracker alleen de data-file aan te passen.
 *
 * Belangrijk: staat er geen enkel ID ingevuld, dan verschijnt de banner niet.
 * Een toestemmingsvraag stellen terwijl er niets te weigeren valt is
 * misleidend, en levert bovendien een cookiemuur op voor niets.
 */
(function () {
  'use strict';

  var CONSENT_KEY = 'boostin_cookie_consent';
  // Ophogen na een beleidswijziging, dan wordt opnieuw gevraagd. Deze twee
  // staan ook in het Consent Mode-blok in src/_layouts/base.njk -- daar mee
  // ophogen, anders blijft GA na een beleidswijziging op de oude keuze staan.
  var CONSENT_VERSION = '1';

  var cfg = window.BOOSTIN_CONSENT_CONFIG || {};
  var GA4_ID = cfg.ga4 || null;
  var CLARITY_ID = cfg.clarity || null;
  var LINKEDIN_PARTNER_ID = cfg.linkedinPartnerId || null;
  var COOKIE_POLICY_URL = cfg.cookiePolicyUrl || '/cookies/';

  // LinkedIn conversie-ID's per event, aan te maken in Campaign Manager onder
  // Analyse > Conversies. Leeg laten tot ze bestaan.
  var LINKEDIN_CONVERSIONS = cfg.linkedinConversions || {};

  // Alleen de productiesite telt mee. Preview-deploys op *.boostin-site.pages.dev
  // en de dev-server draaien dezelfde code met hetzelfde meet-ID; zonder deze
  // rem lopen testbezoeken en klikwerk gewoon mee in de cijfers van boostin.nl.
  // De banner tonen we daar wel, anders is hij op een preview niet te testen.
  var MEASURED_HOSTS = ['boostin.nl', 'www.boostin.nl'];

  function isMeasuredHost() {
    return MEASURED_HOSTS.indexOf(window.location.hostname) !== -1;
  }

  // Valt er iets te kiezen? Zo niet, dan geen banner.
  function hasTrackers() {
    return Boolean(GA4_ID || CLARITY_ID || LINKEDIN_PARTNER_ID);
  }

  function getConsent() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.version === CONSENT_VERSION) return parsed;
      }
    } catch (e) {}
    return null;
  }

  function setConsent(accepted) {
    var consent = {
      version: CONSENT_VERSION,
      analytics: accepted,
      timestamp: new Date().toISOString()
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (e) {}
    return consent;
  }

  /**
   * Zet de Google-tag aan of uit. De tag zelf staat al in de pagina (base.njk),
   * hier gaat alleen de toestemmingsschakelaar om. Zonder "granted" plaatst GA
   * geen cookies en bewaart het geen identifiers.
   */
  function setGA4Consent(granted) {
    if (!GA4_ID || typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied'
    });
  }

  function loadClarity() {
    if (!CLARITY_ID || !isMeasuredHost() || window.boostinClarityLoaded) return;
    window.boostinClarityLoaded = true;

    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  function loadLinkedIn() {
    if (!LINKEDIN_PARTNER_ID || !isMeasuredHost() || window.boostinLinkedInLoaded) return;
    window.boostinLinkedInLoaded = true;

    window._linkedin_partner_id = LINKEDIN_PARTNER_ID;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(LINKEDIN_PARTNER_ID);

    // Queue voor lintrk-calls die vóór insight.min.js gebeuren
    if (!window.lintrk) {
      window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
      window.lintrk.q = [];
    }

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
    document.head.appendChild(s);
  }

  function loadTrackers() {
    setGA4Consent(true);
    loadClarity();
    loadLinkedIn();
  }

  function showBanner() {
    if (document.getElementById('cookie-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookievoorkeuren');
    banner.innerHTML = [
      '<div class="cookie-banner-content">',
      '  <div class="cookie-banner-text">',
      '    <strong>Cookies</strong>',
      '    <p>We willen graag meten hoe onze site gebruikt wordt. Dat doen we alleen met jouw toestemming. ',
      '       <a href="' + COOKIE_POLICY_URL + '">Lees ons cookiebeleid</a></p>',
      '  </div>',
      '  <div class="cookie-banner-buttons">',
      '    <button type="button" id="cookie-reject" class="cookie-btn">Weigeren</button>',
      '    <button type="button" id="cookie-accept" class="cookie-btn">Accepteren</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(banner);

    document.getElementById('cookie-accept').addEventListener('click', function () {
      setConsent(true);
      loadTrackers();
      hideBanner();
    });

    document.getElementById('cookie-reject').addEventListener('click', function () {
      setConsent(false);
      setGA4Consent(false);
      hideBanner();

      // GA luistert direct naar de schakelaar hierboven. Clarity en lintrk niet:
      // eenmaal ingeladen zijn die binnen deze paginasessie niet meer uit te
      // zetten. Herladen is dan de enige manier waarop afmelden direct effect heeft.
      if (window.boostinClarityLoaded || window.boostinLinkedInLoaded) {
        window.location.reload();
      }
    });

    requestAnimationFrame(function () {
      banner.classList.add('cookie-banner-visible');
    });
  }

  function hideBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    banner.classList.remove('cookie-banner-visible');
    setTimeout(function () { banner.remove(); }, 300);
  }

  /**
   * Meld een conversie aan GA4 en LinkedIn. Doet niets zonder toestemming.
   *
   * @param {string} eventName bv. 'contact_aanvraag'
   * @param {object} [params]  extra GA4-parameters
   */
  window.boostinTrackConversion = function (eventName, params) {
    try {
      var consent = getConsent();
      if (!consent || !consent.analytics) return;

      if (window.gtag) window.gtag('event', eventName, params || {});

      var conversionId = LINKEDIN_CONVERSIONS[eventName];
      if (conversionId && window.lintrk) {
        window.lintrk('track', { conversion_id: conversionId });
      }
    } catch (e) {}
  };

  /** Opent de banner opnieuw, voor de link in de footer en op /cookies/. */
  window.openCookieSettings = function () {
    if (!hasTrackers()) {
      window.alert('Deze website plaatst op dit moment alleen noodzakelijke cookies. Er valt dus niets in te stellen.');
      return;
    }
    try { localStorage.removeItem(CONSENT_KEY); } catch (e) {}
    hideBanner();
    setTimeout(showBanner, 100);
  };

  function init() {
    if (!hasTrackers()) return;

    var consent = getConsent();
    if (consent === null) {
      showBanner();
    } else if (consent.analytics) {
      loadTrackers();
    }
    // Geweigerd: niets doen.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
