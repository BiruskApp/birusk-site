/**
 * birusk.app — point d'entrée serveur.
 *
 * Le site reste entièrement statique : ce Worker n'est appelé que sur /api/*,
 * grâce à `run_worker_first` dans wrangler.jsonc. Tout le reste est servi
 * directement depuis dist/, sans passer par ce code.
 *
 *   GET  /api/token     délivre un jeton signé, valable une demi-heure
 *   POST /api/contact   valide le message et l'expédie à contact@birusk.app
 */

/* Unique destination possible : wrangler.jsonc restreint la liaison à cette
   seule adresse, si bien qu'une erreur de code ne peut pas expédier ailleurs.
   Zoho n'accepte ces messages que si le SPF du domaine autorise les serveurs
   de Cloudflare (`include:_spf.mx.cloudflare.net`) : sans cela, la remise est
   refusée, ce qui est le comportement attendu d'une protection
   anti-usurpation. */
const DEST = "contact@birusk.app";
const FROM = { email: "formulaire@birusk.app", name: "Formulaire birusk.app" };

const LIMITS = { name: [2, 80], email: [5, 120], message: [10, 4000] };
const MIN_AGE = 3_000;        // en deçà, personne n'a eu le temps d'écrire
const MAX_AGE = 30 * 60_000;  // au-delà, la page traînait ouverte : on repart de zéro

/* Messages de la page de repli, affichée uniquement lorsque JavaScript est
   absent. L'interface normale, elle, tire ses textes de content.json. */
const SAYS = {
  fr: { ok: "Message envoyé. Réponse sous deux jours.", bad: "Le message n'a pas pu être envoyé : un champ est incomplet.", err: "L'envoi a échoué. Écrivez directement à " + DEST + ".", back: "Retour au site" },
  en: { ok: "Message sent. Reply within two days.", bad: "The message could not be sent: a field is incomplete.", err: "Sending failed. Write directly to " + DEST + ".", back: "Back to the site" },
  ckb: { ok: "نامەکە نێردرا. لە ماوەی دوو ڕۆژدا وەڵام دەدرێتەوە.", bad: "نامەکە نەنێردرا: خانەیەک ناتەواوە.", err: "ناردن سەرکەوتوو نەبوو. ڕاستەوخۆ بنووسە بۆ " + DEST + ".", back: "گەڕانەوە بۆ ماڵپەڕ" },
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ── jeton signé ──────────────────────────────────────────────────────────────
// Le site étant statique, la page ne peut pas porter de jeton propre à chaque
// visiteur : elle vient donc le chercher ici. Un robot qui poste sans exécuter
// de JavaScript n'en a pas, et repart sans avoir rien envoyé.

const enc = new TextEncoder();

async function sign(stamp, secret) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(String(stamp)));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tokenValid(stamp, proof, secret, now) {
  if (!secret) return true;                       // secret non configuré : on n'exclut personne
  const age = now - Number(stamp);
  if (!Number.isFinite(age) || age < MIN_AGE || age > MAX_AGE) return false;
  const expected = await sign(stamp, secret);
  // comparaison à temps constant : une comparaison paresseuse laisse deviner
  // la signature octet par octet
  if (expected.length !== String(proof).length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ String(proof).charCodeAt(i);
  return diff === 0;
}

// ── validation ───────────────────────────────────────────────────────────────

const between = (v, [min, max]) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const looksLikeEmail = (v) => /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(String(v).trim());

function readFields(src) {
  const get = (k) => (src.get ? src.get(k) : src[k]) ?? "";
  return {
    name: String(get("name")).trim(),
    email: String(get("email")).trim(),
    message: String(get("message")).trim(),
    lang: ["fr", "en", "ckb"].includes(String(get("lang"))) ? String(get("lang")) : "fr",
    trap: String(get("site")).trim(),      // champ appât, invisible pour un humain
    stamp: String(get("t")),
    proof: String(get("s")),
  };
}

// ── page de repli, sans JavaScript ───────────────────────────────────────────

const page = (lang, kind, status) => {
  const t = SAYS[lang] ?? SAYS.fr;
  const dir = lang === "ckb" ? "rtl" : "ltr";
  return new Response(
    `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Birusk</title>
<meta name="robots" content="noindex"><style>
body{margin:0;min-height:100svh;display:grid;place-items:center;background:#ffffff;color:#0d0d0e;
font:400 17px/1.6 "Helvetica Neue",Arial,sans-serif;padding:24px;text-align:center}
p{max-width:44ch;margin:0 0 26px}a{color:#9d1b2f;font-weight:700;text-transform:uppercase;
font-size:13px;letter-spacing:.06em;border-bottom:1px solid currentColor;text-decoration:none;padding-bottom:3px}
</style></head><body><div><p>${esc(t[kind])}</p><a href="/">${esc(t.back)}</a></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
};

// ── corps du message ─────────────────────────────────────────────────────────

function compose(f, request) {
  const pays = request.cf?.country ?? "—";
  const quand = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const text =
    `${f.message}\n\n` +
    `—\n` +
    `De      : ${f.name} <${f.email}>\n` +
    `Langue  : ${f.lang}\n` +
    `Pays    : ${pays}\n` +
    `Reçu le : ${quand}\n` +
    `Répondre à ce message écrit directement à l'expéditeur.\n`;

  const html =
    `<div style="font:400 15px/1.65 -apple-system,Helvetica,Arial,sans-serif;color:#0d0d0e">` +
    `<p style="white-space:pre-wrap;margin:0 0 24px">${esc(f.message)}</p>` +
    `<table style="border-collapse:collapse;font-size:13px;color:#6b6b72">` +
    `<tr><td style="padding:3px 16px 3px 0">De</td><td><a href="mailto:${esc(f.email)}" style="color:#9d1b2f">${esc(f.name)} &lt;${esc(f.email)}&gt;</a></td></tr>` +
    `<tr><td style="padding:3px 16px 3px 0">Langue</td><td>${esc(f.lang)}</td></tr>` +
    `<tr><td style="padding:3px 16px 3px 0">Pays</td><td>${esc(pays)}</td></tr>` +
    `<tr><td style="padding:3px 16px 3px 0">Reçu le</td><td>${esc(quand)}</td></tr>` +
    `</table></div>`;

  return { text, html };
}

// ── routage ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/token" && request.method === "GET") {
      const stamp = Date.now();
      const proof = env.FORM_SECRET ? await sign(stamp, env.FORM_SECRET) : "";
      return json({ t: stamp, s: proof });
    }

    if (url.pathname !== "/api/contact") return json({ error: "not_found" }, 404);
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const type = request.headers.get("content-type") ?? "";
    const wantsJson = type.includes("application/json");

    let f;
    try {
      f = readFields(wantsJson ? await request.json() : await request.formData());
    } catch {
      return wantsJson ? json({ error: "malformed" }, 400) : page("fr", "bad", 400);
    }

    // Le champ appât est masqué par le CSS : seul un automate le remplit. On
    // répond « envoyé » sans rien expédier, pour ne pas lui apprendre la règle.
    if (f.trap) return wantsJson ? json({ ok: true }) : page(f.lang, "ok", 200);

    const valide =
      between(f.name, LIMITS.name) &&
      between(f.email, LIMITS.email) && looksLikeEmail(f.email) &&
      between(f.message, LIMITS.message);
    if (!valide) return wantsJson ? json({ error: "invalid" }, 422) : page(f.lang, "bad", 422);

    // Sans JavaScript, la page ne peut pas réclamer de jeton : on renvoie alors
    // vers l'adresse, affichée juste au-dessus du formulaire.
    if (!(await tokenValid(f.stamp, f.proof, env.FORM_SECRET, Date.now())))
      return wantsJson ? json({ error: "expired" }, 403) : page(f.lang, "err", 403);

    const { text, html } = compose(f, request);

    try {
      await env.EMAIL.send({
        to: DEST,
        from: FROM,
        replyTo: f.email,
        subject: `Site — ${f.name}`,
        text, html,
      });
    } catch (e) {
      console.error("envoi impossible", e?.code, e?.message);
      return wantsJson ? json({ error: "send_failed", code: e?.code ?? null }, 502) : page(f.lang, "err", 502);
    }

    return wantsJson ? json({ ok: true }) : page(f.lang, "ok", 200);
  },
};
