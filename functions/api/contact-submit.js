/**
 * Contactformulier van boostin.nl.
 *
 * De site gebruikte Pipedrive Web Forms, maar die formulieren bestaan niet meer
 * (beide URL's geven een 404), waardoor elke CTA op de site dood was. Dit
 * endpoint doet hetzelfde als /api/contact-submit op notifica.nl: het maakt een
 * lead in Pipedrive aan en stuurt de invuller een bevestiging via Resend.
 *
 * Werkt zonder sleutels ook nog: ontbreekt PIPEDRIVE_API_TOKEN of
 * RESEND_API_KEY, dan slaat dat deel over en krijgt de bezoeker nog steeds een
 * bevestiging in beeld -- maar dan is de aanvraag natuurlijk niet vastgelegd.
 * Wat er wel en niet is gelukt staat in het antwoord, zodat je het kunt zien.
 */

const PIPEDRIVE_DOMAIN = 'notifica';
const PIPEDRIVE_API = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

const FROM_ADDRESS = 'Boostin <info@boostin.nl>';
const REPLY_TO = 'info@boostin-consultancy.nl';
const INTERNAL_RECIPIENT = 'info@boostin-consultancy.nl';

const MAX_FIELD = 4000;

// --- kleine helpers ---------------------------------------------------------

function clean(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, MAX_FIELD);
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// --- Pipedrive -------------------------------------------------------------

async function findPerson(email, token) {
  const url = `${PIPEDRIVE_API}/persons/search?` + new URLSearchParams({
    api_token: token, term: email, fields: 'email', exact_match: 'true',
  });
  const resp = await fetch(url);
  const data = await resp.json();
  const items = data.data?.items || [];
  return items.length ? items[0].item : null;
}

async function findOrCreateOrg(company, token) {
  if (!company) return null;

  const searchUrl = `${PIPEDRIVE_API}/organizations/search?` + new URLSearchParams({
    api_token: token, term: company, exact_match: 'false', limit: '5',
  });
  const searchResp = await fetch(searchUrl);
  const searchData = await searchResp.json();

  for (const item of searchData.data?.items || []) {
    const found = item.item.name.toLowerCase();
    const asked = company.toLowerCase();
    if (asked.includes(found) || found.includes(asked)) {
      return { id: item.item.id, name: item.item.name, isNew: false };
    }
  }

  const resp = await fetch(`${PIPEDRIVE_API}/organizations?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: company }),
  });
  const data = await resp.json();
  if (!data.success) throw new Error('organisatie aanmaken mislukt');
  return { id: data.data.id, name: data.data.name, isNew: true };
}

async function createPerson(name, email, phone, orgId, token) {
  const body = { name, email: [{ value: email, primary: true }] };
  if (orgId) body.org_id = orgId;
  if (phone) body.phone = [{ value: phone, primary: true }];

  const resp = await fetch(`${PIPEDRIVE_API}/persons?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.success) throw new Error('persoon aanmaken mislukt');
  return data.data;
}

async function addNote({ personId, label, message, company, pageUrl, token }) {
  const lines = [
    `<b>${escapeHtml(label)}</b>`,
    `Bedrijf: ${escapeHtml(company || '-')}`,
    'Bron: boostin.nl',
  ];
  if (pageUrl) lines.push(`Pagina: ${escapeHtml(pageUrl)}`);
  if (message) lines.push(`Bericht: ${escapeHtml(message)}`);

  await fetch(`${PIPEDRIVE_API}/notes?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: lines.join('<br>'),
      person_id: personId,
      pinned_to_person_flag: 1,
    }),
  });
}

async function createLead(title, personId, orgId, token) {
  const body = { title, person_id: personId };
  if (orgId) body.organization_id = orgId;

  const resp = await fetch(`${PIPEDRIVE_API}/leads?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(`lead aanmaken mislukt: ${JSON.stringify(data)}`);
  return data.data;
}

async function toPipedrive({ name, email, phone, company, message, label, pageUrl, token }) {
  const org = await findOrCreateOrg(company, token);
  const orgId = org ? org.id : null;

  let person = await findPerson(email, token);
  const personIsNew = !person;
  if (!person) person = await createPerson(name, email, phone, orgId, token);

  // Titel maakt in de lijst meteen duidelijk waar het over gaat en dat het
  // Boostin is, want deze Pipedrive wordt ook voor Notifica gebruikt.
  const subject = label || 'Contactaanvraag';
  const leadTitle = `Boostin - ${subject}${company ? ` - ${company}` : ''}`;

  const lead = await createLead(leadTitle, person.id, orgId, token);
  await addNote({ personId: person.id, label: subject, message, company, pageUrl, token });

  return {
    leadId: lead.id,
    leadTitle,
    personId: person.id,
    personIsNew,
    orgId,
    orgIsNew: org ? org.isNew : false,
  };
}

// --- E-mail ----------------------------------------------------------------

function confirmationHtml({ name, message, label }) {
  const firstName = escapeHtml((name || '').split(' ')[0] || '');
  const quoted = message
    ? `<div style="margin:24px 0;padding:16px 20px;background-color:#f5f1ec;border-left:3px solid #ff144f;">
         <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#5b544f;">
           ${escapeHtml(message).replace(/\n/g, '<br>')}
         </p>
       </div>`
    : '';

  return `<!doctype html>
<html lang="nl"><body style="margin:0;padding:0;background-color:#faf7f2;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;font-family:Arial,sans-serif;color:#1a1518;">
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Hoi ${firstName},</p>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
      Bedankt voor je bericht. We hebben je aanvraag ontvangen${label ? ` over <strong>${escapeHtml(label)}</strong>` : ''}
      en nemen binnen ${'één'} werkdag contact met je op.
    </p>
    ${quoted}
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
      Wil je er eerder over spreken? Bel dan gerust: 030 &ndash; 799 02 15.
    </p>
    <p style="margin:32px 0 0;font-size:16px;line-height:1.6;">
      Met vriendelijke groet,<br>
      <strong>Team Boostin</strong>
    </p>
    <hr style="margin:32px 0 16px;border:none;border-top:1px solid #e6dfd6;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#8a827b;">
      Boostin Consultancy &middot; Kerkhofstraat 21, 5554 HG Valkenswaard &middot;
      <a href="https://boostin.nl" style="color:#d1153f;">boostin.nl</a><br>
      Onderdeel van Data Performance Groep
    </p>
  </div>
</body></html>`;
}

function internalHtml({ name, email, phone, company, message, label, pageUrl, crm }) {
  const row = (k, v) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#8a827b;font-size:14px;">${k}</td>
         <td style="padding:6px 0;font-size:14px;color:#1a1518;">${v || '-'}</td></tr>`;

  return `<!doctype html>
<html lang="nl"><body style="margin:0;padding:24px;font-family:Arial,sans-serif;">
  <h2 style="margin:0 0 16px;font-size:18px;color:#1a1518;">Nieuwe aanvraag via boostin.nl</h2>
  <table style="border-collapse:collapse;">
    ${row('Onderwerp', escapeHtml(label || '-'))}
    ${row('Naam', escapeHtml(name))}
    ${row('E-mail', `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`)}
    ${row('Telefoon', escapeHtml(phone || '-'))}
    ${row('Bedrijf', escapeHtml(company || '-'))}
    ${row('Pagina', escapeHtml(pageUrl || '-'))}
    ${row('Pipedrive', crm && crm.leadId ? `lead ${crm.leadId}` : 'niet vastgelegd')}
  </table>
  ${message ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>` : ''}
</body></html>`;
}

async function sendMail(payload, apiKey) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Resend gaf ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

// --- Handler ---------------------------------------------------------------

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Ongeldige aanvraag.' }, 400);
  }

  // Honeypot: een veld dat onzichtbaar is voor mensen en aantrekkelijk voor bots.
  // Stil goedkeuren, zodat een bot niet leert dat hij is doorzien.
  if (clean(body.website)) return json({ success: true });

  const name = clean(body.name);
  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const company = clean(body.company);
  const message = clean(body.message);
  const label = clean(body.title);
  const pageUrl = clean(body.pageUrl);

  if (!name || !email) {
    return json({ success: false, error: 'Vul je naam en e-mailadres in.' }, 400);
  }
  if (!looksLikeEmail(email)) {
    return json({ success: false, error: 'Dat e-mailadres ziet er niet goed uit.' }, 400);
  }

  const results = {};
  let crm = null;

  if (env.PIPEDRIVE_API_TOKEN) {
    try {
      crm = await toPipedrive({
        name, email, phone, company, message, label, pageUrl,
        token: env.PIPEDRIVE_API_TOKEN,
      });
      results.pipedrive = { ok: true, leadId: crm.leadId };
    } catch (err) {
      results.pipedrive = { ok: false, error: String(err.message || err) };
    }
  } else {
    results.pipedrive = { ok: false, error: 'PIPEDRIVE_API_TOKEN ontbreekt' };
  }

  if (env.RESEND_API_KEY) {
    try {
      await sendMail({
        from: FROM_ADDRESS,
        to: [email],
        reply_to: REPLY_TO,
        subject: 'We hebben je aanvraag ontvangen',
        html: confirmationHtml({ name, message, label }),
      }, env.RESEND_API_KEY);
      results.confirmation = { ok: true };
    } catch (err) {
      results.confirmation = { ok: false, error: String(err.message || err) };
    }

    try {
      await sendMail({
        from: FROM_ADDRESS,
        to: [INTERNAL_RECIPIENT],
        reply_to: email,
        subject: `Aanvraag via boostin.nl: ${label || 'contact'}`,
        html: internalHtml({ name, email, phone, company, message, label, pageUrl, crm }),
      }, env.RESEND_API_KEY);
      results.notification = { ok: true };
    } catch (err) {
      results.notification = { ok: false, error: String(err.message || err) };
    }
  } else {
    results.confirmation = { ok: false, error: 'RESEND_API_KEY ontbreekt' };
  }

  // Voor de bezoeker is het gelukt zodra de aanvraag ergens is aangekomen.
  const landed = results.pipedrive?.ok || results.notification?.ok;

  return json(
    {
      success: !!landed,
      error: landed ? undefined : 'We konden je aanvraag niet verwerken. Mail ons op info@boostin-consultancy.nl.',
      results,
    },
    landed ? 200 : 502
  );
}
