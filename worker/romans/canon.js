/**
 * Modèle de lecture du dépôt : transforme des fichiers Markdown en entités
 * navigables sans jamais réécrire la source. Le dépôt reste la vérité ; ceci
 * n'en est qu'une vue.
 *
 * Le dépôt tient plusieurs univers ; chaque univers porte une ou plusieurs
 * œuvres qui partagent son canon. Le monde, les personnages et la chronologie
 * appartiennent à l'univers ; la structure, les promesses et le manuscrit
 * appartiennent à l'œuvre.
 *
 * Chaque instance vit le temps d'une requête et mémorise ses lectures, pour
 * qu'un même fichier ne soit jamais demandé deux fois dans la même page.
 */

import { arborescence, fichier } from "./github.js";
import { separer, tableau } from "./markdown.js";

const CANON = ["00-canon", "10-monde", "20-systeme", "30-personnages", "40-chronologie"];
const INTRIGUE = "50-intrigue";
const MANUSCRIT = "60-manuscrit";

/** Un souligné en tête de segment marque un gabarit : jamais du contenu. */
const estGabarit = (chemin) => chemin.split("/").some((p) => p.startsWith("_"));

export class Depot {
  constructor(env) {
    this.env = env;
    this.memo = new Map();
    this._arbre = null;
  }

  async arbre() {
    if (!this._arbre) this._arbre = await arborescence(this.env);
    return this._arbre;
  }

  lire(chemin) {
    if (!this.memo.has(chemin)) this.memo.set(chemin, fichier(chemin, this.env));
    return this.memo.get(chemin);
  }

  async fiche(chemin) {
    const source = await this.lire(chemin);
    return { chemin, ...separer(source), source };
  }

  /** Tous les chemins Markdown sous un préfixe, gabarits exclus. */
  async sous(prefixe) {
    return (await this.arbre())
      .map((n) => n.chemin)
      .filter((c) => c.startsWith(prefixe) && c.endsWith(".md") && !estGabarit(c))
      .sort();
  }

  /** Les univers du dépôt, chacun avec la liste de ses œuvres. */
  async univers() {
    const arbre = await this.arbre();
    const noms = [...new Set(arbre
      .map((n) => n.chemin)
      .filter((c) => c.startsWith("univers/"))
      .map((c) => c.split("/")[1])
      .filter((n) => n && !n.startsWith("_")))].sort();

    return Promise.all(noms.map(async (nom) => {
      const u = new Univers(this, nom);
      return { ...(await u.identite()), oeuvres: await u.oeuvres() };
    }));
  }

  monde(nom) { return new Univers(this, nom); }
}

// ── univers ─────────────────────────────────────────────────────────────────

export class Univers {
  constructor(depot, nom) {
    this.depot = depot;
    this.nom = nom;                       // segment d'URL, ex. « vertagne »
    this.racine = `univers/${nom}`;
  }

  async existe() {
    return (await this.depot.arbre()).some((n) => n.chemin.startsWith(this.racine + "/"));
  }

  async identite() {
    const f = await this.depot.fiche(`${this.racine}/UNIVERS.md`).catch(() => null);
    return {
      nom: this.nom,
      id: f?.meta?.id ?? `uni-${this.nom}`,
      titre: f?.meta?.nom ?? this.nom,
      statut: f?.meta?.statut ?? "",
      resume: f ? premierParagraphe(f.corps) : "",
      corps: f?.corps ?? "",
    };
  }

  async oeuvres() {
    const noms = [...new Set((await this.depot.arbre())
      .map((n) => n.chemin)
      .filter((c) => c.startsWith(`${this.racine}/oeuvres/`))
      .map((c) => c.split("/")[3])
      .filter((n) => n && !n.startsWith("_")))];

    const liste = await Promise.all(noms.map(async (nom) => {
      const o = new Oeuvre(this, nom);
      return o.identite();
    }));
    return liste.sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.titre.localeCompare(b.titre, "fr"));
  }

  oeuvre(nom) { return new Oeuvre(this, nom); }

  /** Tous les chapitres de l'univers, tous tomes confondus. */
  async tousChapitres() {
    const oeuvres = await this.oeuvres();
    const paquets = await Promise.all(oeuvres.map(async (o) => {
      const chapitres = await this.oeuvre(o.nom).chapitres();
      return chapitres.map((c) => ({ ...c, oeuvre: o.nom, titreOeuvre: o.titre }));
    }));
    return paquets.flat();
  }

  async personnages() {
    const chemins = await this.depot.sous(`${this.racine}/30-personnages/`);
    const fiches = await Promise.all(chemins.map((c) => this.depot.fiche(c)));
    return fiches
      .filter((f) => f.meta.id)
      .map((f) => ({
        id: f.meta.id,
        nom: f.meta.nom ?? f.meta.id,
        role: f.meta.role ?? "",
        statut: f.meta.statut ?? "",
        premiere: f.meta.premiere_apparition ?? null,
        chemin: f.chemin,
        corps: f.corps,
        relations: tableau(f.corps, "Relations"),
        resume: premierParagraphe(f.corps),
      }))
      .sort((a, b) => ordreRole(a.role) - ordreRole(b.role) || a.nom.localeCompare(b.nom, "fr"));
  }

  async lieux() {
    const fiches = await this.fichesDeMonde("lie-");
    if (fiches.length) return fiches;
    const source = await this.depot.lire(`${this.racine}/10-monde/geographie.md`).catch(() => "");
    return tableau(source, "Lieux").map(depuisLigne("lie"));
  }

  async factions() {
    const fiches = await this.fichesDeMonde("fac-");
    if (fiches.length) return fiches;
    const source = await this.depot.lire(`${this.racine}/10-monde/factions.md`).catch(() => "");
    return tableau(source, "Grille par faction (`fac-xxx`)").map(depuisLigne("fac"));
  }

  async fichesDeMonde(prefixe) {
    const chemins = await this.depot.sous(`${this.racine}/10-monde/`);
    const fiches = await Promise.all(chemins.map((c) => this.depot.fiche(c)));
    return fiches
      .filter((f) => String(f.meta.id ?? "").startsWith(prefixe))
      .map((f) => ({
        id: f.meta.id,
        nom: f.meta.nom ?? f.meta.id,
        statut: f.meta.statut ?? "",
        chemin: f.chemin,
        corps: f.corps,
        resume: premierParagraphe(f.corps),
      }));
  }

  async savoir() {
    const source = await this.depot
      .lire(`${this.racine}/40-chronologie/qui-sait-quoi.md`).catch(() => "");
    return {
      revelations: tableau(source, "Révélations"),
      table: tableau(source, "Table de savoir"),
      mensonges: tableau(source, "Mensonges actifs"),
    };
  }

  async questionsOuvertes() {
    const source = await this.depot
      .lire(`${this.racine}/00-canon/QUESTIONS-OUVERTES.md`).catch(() => "");
    const enAttente = source.split(/^##\s+Tranch[ée]es\s*$/m)[0] ?? source;
    return [...enAttente.matchAll(/^###\s+(QO-\d+)\s+—\s+(.+)$/gm)]
      .map((m) => ({ id: m[1], titre: m[2].trim() }));
  }

  /** Fiches techniques du monde, pour la navigation « Monde ». */
  async documents() {
    const listes = await Promise.all(CANON.map((d) => this.depot.sous(`${this.racine}/${d}/`)));
    return listes.flat();
  }
}

// ── œuvre ───────────────────────────────────────────────────────────────────

export class Oeuvre {
  constructor(univers, nom) {
    this.univers = univers;
    this.nom = nom;
    this.racine = `${univers.racine}/oeuvres/${nom}`;
  }

  async identite() {
    const f = await this.univers.depot.fiche(`${this.racine}/OEUVRE.md`).catch(() => null);
    return {
      nom: this.nom,
      id: f?.meta?.id ?? `oeu-${this.nom}`,
      titre: f?.meta?.nom ?? this.nom,
      statut: f?.meta?.statut ?? "",
      ordre: f?.meta?.ordre ?? 0,
      resume: f ? premierParagraphe(f.corps) : "",
      corps: f?.corps ?? "",
    };
  }

  async chapitres() {
    const chemins = await this.univers.depot.sous(`${this.racine}/${MANUSCRIT}/`);
    const fiches = await Promise.all(chemins.map((c) => this.univers.depot.fiche(c)));
    return fiches
      .filter((f) => f.meta.id)
      .map((f) => ({
        id: f.meta.id,
        titre: f.meta.titre ?? f.meta.id,
        numero: f.meta.numero ?? 0,
        partie: f.meta.partie ?? null,
        statut: f.meta.statut ?? "brouillon",
        pov: f.meta.pov ?? null,
        date: f.meta.date_recit ?? null,
        lieux: f.meta.lieux ?? [],
        personnages: f.meta.personnages ?? [],
        promessesPosees: f.meta.promesses_posees ?? [],
        promessesTenues: f.meta.promesses_tenues ?? [],
        revelations: f.meta.revelations ?? [],
        mots: f.meta.mots ?? compterMots(f.corps),
        chemin: f.chemin,
        corps: f.corps,
      }))
      .sort((a, b) => (a.numero || 0) - (b.numero || 0));
  }

  async promesses() {
    const source = await this.univers.depot
      .lire(`${this.racine}/${INTRIGUE}/promesses.md`).catch(() => "");
    return tableau(source)
      .map((l) => ({
        id: l.ID ?? "",
        texte: l.Promesse ?? "",
        type: l.Type ?? "",
        posee: l["Posée au"] ?? "",
        tenue: l["Tenue au"] ?? "",
        statut: l.Statut ?? (l["Tenue au"] ? "tenue" : "ouverte"),
      }))
      .filter((p) => /^PRO-\d+$/.test(p.id) && !estGabaritDeTexte(p.texte));
  }

  async documents() {
    return this.univers.depot.sous(`${this.racine}/${INTRIGUE}/`);
  }
}

// ── journal du dépôt ────────────────────────────────────────────────────────

export async function journal(depot) {
  const source = await depot.lire("90-journal/passes.md").catch(() => "");
  // Le fichier documente son propre format dans un bloc de code : les titres
  // qui s'y trouvent sont un gabarit, pas des passes réelles.
  return [...sansBlocsDeCode(source).matchAll(/^##\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((t) => !/^AAAA-MM-JJ/.test(t))
    .slice(0, 8);
}

export async function prochainePasse(depot) {
  const source = await depot.lire("90-journal/PROCHAINE-PASSE.md").catch(() => "");
  const champ = (nom) =>
    new RegExp(`^-\\s*\\*\\*${nom}\\*\\*\\s*:\\s*(.+)$`, "mi").exec(source)?.[1]?.trim() ?? "";
  const objectif = section(source, "Objectif");
  return {
    statut: /^##\s*Statut\s*:\s*(.+)$/m.exec(source)?.[1]?.trim() ?? "inconnu",
    univers: champ("Univers"),
    oeuvre: champ("Œuvre"),
    objectif: estGabaritDeTexte(objectif) ? "" : objectif,
  };
}

// ── outils ───────────────────────────────────────────────────────────────────

/** Les gabarits emploient « _à définir_ », « _(vide)_ » : ce n'est pas du contenu. */
export const estGabaritDeTexte = (t) =>
  !t || /^_.*_$/.test(String(t).trim()) || /^\(?vide\)?$/i.test(String(t).trim())
  || /^_?aucune?_?$/i.test(String(t).trim());

const sansBlocsDeCode = (source) => String(source ?? "").replace(/```[\s\S]*?```/g, "");

const ORDRES = { protagoniste: 0, antagoniste: 1, secondaire: 2, figure: 3 };
const ordreRole = (r) => ORDRES[String(r).toLowerCase()] ?? 9;

const depuisLigne = (prefixe) => (l) => {
  const id = Object.values(l).find((v) => new RegExp(`^${prefixe}-[\\w-]+$`).test(v)) ?? "";
  const cles = Object.keys(l);
  return {
    id,
    nom: l[cles[1]] || id,
    statut: "",
    chemin: null,
    resume: cles.slice(2).map((c) => l[c]).filter(Boolean).join(" · "),
  };
};

export function premierParagraphe(corps) {
  for (const bloc of String(corps ?? "").split(/\n\s*\n/)) {
    const t = bloc.trim();
    if (!t || t.startsWith("#") || t.startsWith(">") || t.startsWith("|") || t.startsWith("-")) continue;
    return t.replace(/\s+/g, " ").slice(0, 240);
  }
  return "";
}

export const compterMots = (texte) =>
  String(texte ?? "").replace(/[#>|*_`\-]/g, " ").split(/\s+/).filter(Boolean).length;

function section(source, titre) {
  const debut = source.search(new RegExp(`^##\\s+${titre}\\s*$`, "mi"));
  if (debut === -1) return "";
  const reste = source.slice(debut).replace(/^##.*\n/, "");
  const fin = reste.search(/^##\s+/m);
  return (fin === -1 ? reste : reste.slice(0, fin)).trim();
}

/** Graphe des relations : sommets = personnages, arêtes = lignes de leurs tables. */
export function graphe(personnages) {
  const connus = new Map(personnages.map((p) => [p.id, p]));
  const aretes = [];
  const vues = new Set();
  for (const p of personnages) {
    for (const ligne of p.relations) {
      const cles = Object.keys(ligne);
      const cible = (ligne[cles[0]] ?? "").replace(/`/g, "").trim();
      if (!connus.has(cible) || cible === p.id) continue;
      const cle = [p.id, cible].sort().join("|");
      if (vues.has(cle)) continue;
      vues.add(cle);
      aretes.push({ de: p.id, vers: cible, nature: (ligne[cles[1]] ?? "").trim() });
    }
  }
  return { sommets: personnages, aretes };
}
