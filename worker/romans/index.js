/**
 * /prv/romans — espace de lecture privé des univers et des manuscrits.
 *
 * Lecture seule, et c'est délibéré : le dépôt reste la seule source de vérité.
 * Ce site en donne une vue navigable depuis un téléphone, sans jamais permettre
 * de modifier quoi que ce soit depuis le navigateur.
 *
 * Chemins :
 *   /prv/romans                                   tous les univers
 *   /prv/romans/u/<univers>                       tableau de bord de l'univers
 *   /prv/romans/u/<univers>/personnages[/<id>]    le canon vivant
 *   /prv/romans/u/<univers>/lieux | relations | monde | doc/<chemin>
 *   /prv/romans/u/<univers>/o/<oeuvre>            tableau de bord du livre
 *   /prv/romans/u/<univers>/o/<oeuvre>/chapitres[/<id>]
 *   /prv/romans/propositions                      les PR en attente
 */

import { sessionValide, ouvrirSession, fermerSession, codeJuste, tropDEssais } from "./auth.js";
import { Depot, graphe, journal, prochainePasse } from "./canon.js";
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

  if (reste === "/sortie") return versLa(BASE, { "set-cookie": fermerSession() });

  if (!(await sessionValide(request, env))) {
    if (!env.ROMANS_CODE || !env.ROMANS_SECRET) {
      return html(V.connexion("Accès non configuré sur le serveur."), 503);
    }
    return html(V.connexion(), 401);
  }

  try {
    return await router(reste, env);
  } catch (e) {
    if (e instanceof DepotIndisponible) {
      const aide = e.statut === 503
        ? "Le secret <code>ROMANS_GH_TOKEN</code> n'est pas installé. Le reste du site fonctionne."
        : "Vérifiez que le jeton GitHub est valide et donne accès en lecture à <code>BiruskApp/Books</code>.";
      return html(V.erreur(e.message, aide), e.statut === 404 ? 404 : 503);
    }
    console.error("romans", e?.stack ?? e);
    return html(V.erreur("Une erreur interne est survenue."), 500);
  }
}

// ── routage ─────────────────────────────────────────────────────────────────

async function router(reste, env) {
  const depot = new Depot(env);

  if (reste === "" || reste === "/") {
    const [univers, passe, entrees, prs] = await Promise.all([
      depot.univers(), prochainePasse(depot), journal(depot),
      pullRequests(env).catch(() => []),
    ]);
    return html(V.accueil({ univers, passe, journal: entrees, prs }));
  }

  if (reste === "/propositions") {
    return html(V.propositions(await pullRequests(env), (corps) => rendre(corps, {})));
  }

  const chemin = reste.split("/").filter(Boolean).map(decodeURIComponent);
  if (chemin[0] !== "u" || !chemin[1]) return html(V.erreur("Page inconnue."), 404);

  const monde = depot.monde(chemin[1]);
  if (!(await monde.existe())) return html(V.erreur("Cet univers n'existe pas."), 404);
  const u = await monde.identite();

  // /u/<univers>/o/<oeuvre>/…
  if (chemin[2] === "o") {
    if (!chemin[3]) return html(V.erreur("Œuvre manquante."), 404);
    return routerOeuvre(monde, u, chemin[3], chemin.slice(4), env);
  }

  return routerUnivers(monde, u, chemin.slice(2), env);
}

async function routerUnivers(monde, u, suite, env) {
  const [section, argument] = suite;

  if (!section) {
    const [oeuvres, personnages, chapitres, questions] = await Promise.all([
      monde.oeuvres(), monde.personnages(), monde.tousChapitres(), monde.questionsOuvertes(),
    ]);
    const noms = index(personnages);
    return html(V.tableauUnivers(u, {
      oeuvres, personnages, chapitres, questions,
      html: u.corps ? rendre(depouiller(u.corps), contexte(u, noms)) : "",
    }));
  }

  if (section === "personnages" && !argument) {
    return html(V.listePersonnages(u, await monde.personnages()));
  }

  if (section === "personnages") {
    const [personnages, chapitres, savoir] = await Promise.all([
      monde.personnages(), monde.tousChapitres(), monde.savoir(),
    ]);
    const p = personnages.find((x) => x.id === argument);
    if (!p) return html(V.erreur("Ce personnage n'existe pas dans cet univers."), 404);
    const { aretes } = graphe(personnages);
    return html(V.unPersonnage(u, { ...p, lienDepot: lienDepot(p.chemin, env) }, {
      html: rendre(p.corps, contexte(u, index(personnages))),
      apparitions: chapitres.filter((c) => c.personnages.includes(p.id) || c.pov === p.id),
      liens: aretes.filter((a) => a.de === p.id || a.vers === p.id)
        .map((a) => ({ id: a.de === p.id ? a.vers : a.de, nature: a.nature })),
      nom: nommeur(personnages),
      savoir: savoir.table
        .filter((l) => Object.values(l).some((v) => v.replace(/`/g, "") === p.id))
        .map((l) => {
          const c = Object.values(l);
          return { revelation: c[1] ?? "", chapitre: c[2] ?? "", etat: c[4] ?? c[3] ?? "" };
        }),
    }));
  }

  if (section === "lieux") {
    const [lieux, factions] = await Promise.all([monde.lieux(), monde.factions()]);
    return html(V.listeLieux(u, lieux, factions));
  }

  if (section === "relations") {
    return html(V.relations(u, graphe(await monde.personnages())));
  }

  if (section === "monde") {
    return html(V.monde(u, await monde.documents()));
  }

  if (section === "doc") {
    const cible = suite.slice(1).join("/");
    if (!cible.endsWith(".md") || cible.includes("..")) {
      return html(V.erreur("Document invalide."), 400);
    }
    const permis = await monde.documents();
    if (!permis.includes(cible)) return html(V.erreur("Ce document n'existe pas."), 404);
    const { meta, corps } = separer(await monde.depot.lire(cible));
    const titre = meta.nom ?? /^#\s+(.+)$/m.exec(corps)?.[1] ?? cible.split("/").pop();
    const noms = index(await monde.personnages());
    return html(V.document_(u, titre, rendre(depouiller(corps), contexte(u, noms)),
                            cible.split("/").slice(2).join("/"), lienDepot(cible, env)));
  }

  return html(V.erreur("Page inconnue."), 404);
}

async function routerOeuvre(monde, u, nomOeuvre, suite, env) {
  const oeuvres = await monde.oeuvres();
  const o = oeuvres.find((x) => x.nom === nomOeuvre);
  if (!o) return html(V.erreur("Cette œuvre n'existe pas dans cet univers."), 404);

  const livre = monde.oeuvre(nomOeuvre);
  const [section, argument] = suite;

  if (!section) {
    const [chapitres, promesses, personnages] = await Promise.all([
      livre.chapitres(), livre.promesses(), monde.personnages(),
    ]);
    return html(V.tableauOeuvre(u, o, {
      chapitres, promesses,
      html: o.corps ? rendre(depouiller(o.corps), contexte(u, index(personnages))) : "",
    }));
  }

  if (section === "chapitres" && !argument) {
    const [chapitres, personnages] = await Promise.all([livre.chapitres(), monde.personnages()]);
    return html(V.listeChapitres(u, o, chapitres, nommeur(personnages)));
  }

  if (section === "chapitres") {
    const [chapitres, personnages, lieux] = await Promise.all([
      livre.chapitres(), monde.personnages(), monde.lieux(),
    ]);
    const rang = chapitres.findIndex((c) => c.id === argument);
    if (rang === -1) return html(V.erreur("Ce chapitre n'existe pas."), 404);
    return html(V.unChapitre(u, o, chapitres[rang], {
      html: rendre(depouiller(chapitres[rang].corps), contexte(u, index(personnages, lieux))),
      nom: nommeur(personnages, lieux),
      precedent: chapitres[rang - 1] ?? null,
      suivant: chapitres[rang + 1] ?? null,
    }));
  }

  return html(V.erreur("Page inconnue."), 404);
}

// ── outils ──────────────────────────────────────────────────────────────────

/** Rend cliquables les identifiants du canon rencontrés dans le corps des fiches. */
const contexte = (u, noms) => ({
  identifiant: (id) =>
    id.startsWith("per-") && noms.has(id) ? `${V.lienU(u.nom)}/personnages/${id}` : null,
  interne: () => `${V.lienU(u.nom)}/monde`,
});

function index(...listes) {
  const m = new Map();
  for (const liste of listes) for (const e of liste ?? []) m.set(e.id, e.nom);
  return m;
}

const nommeur = (...listes) => {
  const m = index(...listes);
  return (id) => m.get(id) ?? id;
};

/** Retire le premier titre (repris par la page) et les consignes de gabarit. */
function depouiller(corps) {
  return String(corps ?? "")
    .replace(/^#\s+.+\n/, "")
    .replace(/^>\s*(Copier ce fichier|Gabarit)[\s\S]*?(?=\n\n)/m, "")
    .trim();
}
