/**
 * Accès à /prv/romans — code partagé, session signée.
 *
 * Le code lui-même ne quitte jamais le serveur : il est comparé à temps constant,
 * puis remplacé par un cookie signé qui ne contient qu'une date d'expiration.
 * Voler le cookie ne donne donc pas le code, et il périme seul.
 */

const COOKIE = "prv_romans";
const DUREE = 30 * 24 * 3600 * 1000;   // un mois, puis on redemande le code
const ESSAIS_MAX = 8;                  // par adresse IP et par quart d'heure

const enc = new TextEncoder();

const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function signer(message, secret) {
  const cle = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", cle, enc.encode(String(message))));
}

/** Comparaison à temps constant : une comparaison paresseuse laisse deviner
    la valeur attendue caractère par caractère. */
function identiques(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function lireCookie(entete, nom) {
  for (const morceau of (entete ?? "").split(";")) {
    const [cle, ...reste] = morceau.trim().split("=");
    if (cle === nom) return reste.join("=");
  }
  return null;
}

/** Le visiteur présente-t-il une session valide ? */
export async function sessionValide(request, env) {
  const secret = env.ROMANS_SECRET;
  if (!secret) return false;                       // mal configuré : on ferme
  const brut = lireCookie(request.headers.get("cookie"), COOKIE);
  if (!brut) return false;
  const [expiration, preuve] = decodeURIComponent(brut).split(".");
  if (!expiration || !preuve) return false;
  if (Number(expiration) < Date.now()) return false;
  return identiques(preuve, await signer(expiration, secret));
}

export async function ouvrirSession(env) {
  const expiration = Date.now() + DUREE;
  const preuve = await signer(expiration, env.ROMANS_SECRET);
  return `${COOKIE}=${expiration}.${preuve}; Path=/prv; Max-Age=${DUREE / 1000}` +
         `; HttpOnly; Secure; SameSite=Lax`;
}

export const fermerSession = () =>
  `${COOKIE}=; Path=/prv; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export const codeJuste = (propose, env) =>
  Boolean(env.ROMANS_CODE) && identiques(propose ?? "", env.ROMANS_CODE);

/**
 * Freine les tentatives répétées. Le compteur vit dans le cache de la zone :
 * imparfait — il est propre à chaque centre de données — mais suffisant pour
 * qu'une attaque par dictionnaire cesse d'être rentable, et sans stockage.
 */
export async function tropDEssais(request) {
  const ip = request.headers.get("cf-connecting-ip") ?? "inconnue";
  const cle = new Request(`https://romans.invalid/essais/${encodeURIComponent(ip)}`);
  const cache = caches.default;
  const vu = await cache.match(cle);
  const n = vu ? Number(await vu.text()) || 0 : 0;
  return { depasse: n >= ESSAIS_MAX, compter: () =>
    cache.put(cle, new Response(String(n + 1), {
      headers: { "cache-control": "max-age=900" },
    })),
  };
}
