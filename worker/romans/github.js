/**
 * Lecture du dépôt privé BiruskApp/Books.
 *
 * Le jeton est un jeton GitHub à portée restreinte (lecture seule, ce seul dépôt),
 * conservé comme secret Cloudflare. Les réponses sont mises en cache une minute :
 * le site reste vivant sans épuiser le quota de l'API.
 */

const DEPOT = "BiruskApp/Books";
const API = "https://api.github.com";
const FRAICHEUR = 60;   // secondes

/* Branche lue. `main` en production ; l'écraser sert à éprouver l'interface sur
   une branche d'essai sans rien publier dans le canon. */
const branche = (env) => env.ROMANS_GH_BRANCHE || "main";

export class DepotIndisponible extends Error {
  constructor(raison, statut) {
    super(raison);
    this.statut = statut;
  }
}

async function appel(chemin, env, { brut = false } = {}) {
  if (!env.ROMANS_GH_TOKEN) {
    throw new DepotIndisponible("jeton GitHub non configuré", 503);
  }
  const url = `${API}${chemin}`;
  const cle = new Request(url, { headers: { accept: brut ? "raw" : "json" } });
  const cache = caches.default;

  const enCache = await cache.match(cle);
  if (enCache) return brut ? enCache.text() : enCache.json();

  const reponse = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.ROMANS_GH_TOKEN}`,
      accept: brut ? "application/vnd.github.raw" : "application/vnd.github+json",
      "user-agent": "birusk-romans",
      "x-github-api-version": "2022-11-28",
    },
  });

  if (!reponse.ok) {
    const detail = reponse.status === 401 || reponse.status === 403
      ? "jeton GitHub refusé ou expiré"
      : reponse.status === 404
        ? "dépôt ou fichier introuvable"
        : `GitHub a répondu ${reponse.status}`;
    throw new DepotIndisponible(detail, reponse.status === 404 ? 404 : 502);
  }

  const corps = await reponse.text();
  await cache.put(cle, new Response(corps, {
    headers: {
      "cache-control": `max-age=${FRAICHEUR}`,
      "content-type": brut ? "text/plain; charset=utf-8" : "application/json",
    },
  }));
  return brut ? corps : JSON.parse(corps);
}

/** Arborescence complète du dépôt : un seul appel, tout le reste en découle. */
export async function arborescence(env) {
  const donnees = await appel(
    `/repos/${DEPOT}/git/trees/${branche(env)}?recursive=1`, env,
  );
  return (donnees.tree ?? [])
    .filter((n) => n.type === "blob")
    .map((n) => ({ chemin: n.path, taille: n.size }));
}

export const fichier = (chemin, env) =>
  appel(`/repos/${DEPOT}/contents/${encodeURI(chemin)}?ref=${branche(env)}`, env, { brut: true });

/** Les propositions en attente de validation. */
export async function propositions(env) {
  const liste = await appel(`/repos/${DEPOT}/pulls?state=open&per_page=30`, env);
  return liste.map((p) => ({
    numero: p.number,
    titre: p.title,
    corps: p.body ?? "",
    branche: p.head?.ref ?? "",
    auteur: p.user?.login ?? "",
    ouverte: p.created_at,
    majAt: p.updated_at,
    lien: p.html_url,
    brouillon: p.draft,
  }));
}

/** Les derniers commits fusionnés — le fil d'activité du chantier. */
export async function activite(env) {
  const liste = await appel(`/repos/${DEPOT}/commits?sha=${branche(env)}&per_page=15`, env);
  return liste.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: (c.commit?.message ?? "").split("\n")[0],
    date: c.commit?.author?.date ?? "",
    auteur: c.commit?.author?.name ?? "",
    lien: c.html_url,
  }));
}

export const lienDepot = (chemin, env) =>
  `https://github.com/${DEPOT}/blob/${env?.ROMANS_GH_BRANCHE || "main"}/${chemin}`;
