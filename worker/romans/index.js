/**
 * /prv/romans — espace de lecture privé de l'univers et du manuscrit.
 *
 * Lecture seule, et c'est délibéré : le dépôt reste la seule source de vérité.
 * Ce site en donne une vue navigable depuis un téléphone, sans jamais permettre
 * de modifier quoi que ce soit depuis le navigateur.
 */

import { sessionValide, ouvrirSession, fermerSession, codeJuste, tropDEssais } from "./auth.js";
import { Depot, graphe } from "./canon.js";
import { DepotIndisponible, propositions as pullRequests, lienDepot } from "./github.js";
import { rendre, separer } from "./markdown.js";
import * as V from "./vues.js";

const BASE = "/prv/romans";

const html = (corps, statut = 200, entetes = {}) =>
  new Response(corps, {
    status: statut,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      ...entetes,
    },
  });

const versLa = (voie, entetes = {}) =>
  new Response(null, { status: 303, headers: { location: voie, "cache-control": "no-store", ...entetes } });

export async function servirRomans(request, env) {
  const url = new URL(request.url);
  const voie = url.pathname.replace(/\/+$/, "") || BASE;
  const reste = voie.slice(BASE.length) || "";

  // ── porte ──
  if (reste === "/entree" && request.method === "POST") {
    const { depasse, compter } = await tropDEssais(request);
    if (depasse) return html(V.connexion("Trop de tentatives. Réessayez dans un quart d'heure."), 429);
    const formulaire = await request.formData().catch(() => null);
    if (codeJuste(formulaire?.get("code"), env)) {
      return versLa(BASE, { "set-cookie": await ouvrirSession(env) });
    }
    await compter();
    return html(V.connexion("Code incorrect."), 401);
  }

  if (reste === "/sortie") {
    return versLa(BASE, { "set-cookie": fermerSession() });
  }

  if (!(await sessionValide(request, env))) {
    if (!env.ROMANS_CODE || !env.ROMANS_SECRET) {
      return html(V.connexion("Accès non configuré sur le serveur."), 503);
    }
    return html(V.connexion(), 401);
  }

  // ── contenu ──
  try {
    return await router(reste, env);
  } catch (e) {
    if (e instanceof DepotIndisponible) {
      const aide = e.statut === 503
        ? "Le secret <code>ROMANS_GH_TOKEN</code> n'est pas encore installé. Le reste du site fonctionne."
        : "Vérifiez que le jeton GitHub est valide et qu'il donne accès en lecture à <code>BiruskApp/Books</code>.";
      return html(V.erreur(e.message, aide), e.statut === 404 ? 404 : 503);
    }
    console.error("romans", e?.stack ?? e);
    return html(V.erreur("Une erreur interne est survenue."), 500);
  }
}

async function router(reste, env) {
  const depot = new Depot(env);

  // Rend un identifiant lisible et cliquable dans le corps des fiches.
  const contexte = (noms) => ({
    identifiant: (id) => (noms.has(id) ? lienVers(id) : null),
    interne: (chemin) => `${BASE}/doc/${chemin.replace(/^\.\//, "")}`,
  });

  if (reste === "" || reste === "/") {
    const [chapitres, personnages, promesses, questions, passe, journal, prs] = await Promise.all([
      depot.chapitres(), depot.personnages(), depot.promesses(),
      depot.questionsOuvertes(), depot.prochainePasse(), depot.journal(),
      pullRequests(env).catch(() => []),
    ]);
    return html(V.tableauDeBord({ chapitres, personnages, promesses, questions, passe, journal, prs }));
  }

  if (reste === "/chapitres") {
    const [chapitres, personnages] = await Promise.all([depot.chapitres(), depot.personnages()]);
    return html(V.listeChapitres(chapitres, nommeur(personnages)));
  }

  if (reste.startsWith("/chapitres/")) {
    const id = decodeURIComponent(reste.slice("/chapitres/".length));
    const [chapitres, personnages, lieux] = await Promise.all([
      depot.chapitres(), depot.personnages(), depot.lieux(),
    ]);
    const rang = chapitres.findIndex((c) => c.id === id);
    if (rang === -1) return html(V.erreur("Ce chapitre n'existe pas."), 404);
    const noms = index(personnages, lieux);
    return html(V.unChapitre(chapitres[rang], {
      html: rendre(depouiller(chapitres[rang].corps), contexte(noms)),
      nom: nommeur(personnages, lieux),
      precedent: chapitres[rang - 1] ?? null,
      suivant: chapitres[rang + 1] ?? null,
    }));
  }

  if (reste === "/personnages") {
    return html(V.listePersonnages(await depot.personnages()));
  }

  if (reste.startsWith("/personnages/")) {
    const id = decodeURIComponent(reste.slice("/personnages/".length));
    const [personnages, chapitres, savoir] = await Promise.all([
      depot.personnages(), depot.chapitres(), depot.savoir(),
    ]);
    const p = personnages.find((x) => x.id === id);
    if (!p) return html(V.erreur("Ce personnage n'existe pas."), 404);
    const noms = index(personnages);
    const { aretes } = graphe(personnages);
    return html(V.unPersonnage({ ...p, lienDepot: lienDepot(p.chemin) }, {
      html: rendre(p.corps, contexte(noms)),
      apparitions: chapitres.filter((c) => c.personnages.includes(id) || c.pov === id),
      liens: aretes.filter((a) => a.de === id || a.vers === id)
        .map((a) => ({ id: a.de === id ? a.vers : a.de, nature: a.nature })),
      nom: nommeur(personnages),
      savoir: savoir.table
        .filter((l) => Object.values(l).includes(id) || Object.values(l).includes("`" + id + "`"))
        .map((l) => {
          const c = Object.values(l);
          return { revelation: c[1] ?? "", chapitre: c[2] ?? "", etat: c[4] ?? c[3] ?? "" };
        }),
    }));
  }

  if (reste === "/lieux") {
    const [lieux, factions] = await Promise.all([depot.lieux(), depot.factions()]);
    return html(V.listeLieux(lieux, factions));
  }

  if (reste === "/relations") {
    return html(V.relations(graphe(await depot.personnages())));
  }

  if (reste === "/monde") {
    return html(V.monde(await depot.documents()));
  }

  if (reste.startsWith("/doc/")) {
    const chemin = decodeURIComponent(reste.slice("/doc/".length));
    if (!chemin.endsWith(".md") || chemin.includes("..")) {
      return html(V.erreur("Document invalide."), 400);
    }
    const permis = await depot.documents();
    if (!permis.includes(chemin)) return html(V.erreur("Ce document n'existe pas."), 404);
    const source = await depot.lire(chemin);
    const { meta, corps } = separer(source);
    const noms = index(await depot.personnages());
    const titre = meta.nom ?? /^#\s+(.+)$/m.exec(corps)?.[1] ?? chemin.split("/").pop();
    return html(V.document_(titre, rendre(depouiller(corps), contexte(noms)), chemin, lienDepot(chemin)));
  }

  if (reste === "/propositions") {
    const liste = await pullRequests(env);
    return html(V.propositions(liste, (corps) => rendre(corps, {})));
  }

  return html(V.erreur("Page inconnue."), 404);
}

// ── outils ──────────────────────────────────────────────────────────────────

const lienVers = (id) =>
  id.startsWith("per-") ? `${BASE}/personnages/${id}`
  : id.startsWith("cha-") ? `${BASE}/chapitres/${id}`
  : null;

function index(...listes) {
  const m = new Map();
  for (const liste of listes) for (const e of liste ?? []) m.set(e.id, e.nom);
  return m;
}

const nommeur = (...listes) => {
  const m = index(...listes);
  return (id) => m.get(id) ?? id;
};

/** Retire le premier titre (repris par la page) et les blocs de consigne interne. */
function depouiller(corps) {
  return String(corps ?? "")
    .replace(/^#\s+.+\n/, "")
    .replace(/^>\s*Copier ce fichier[\s\S]*?(?=\n\n)/m, "")
    .trim();
}
