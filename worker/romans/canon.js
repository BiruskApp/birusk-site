/**
 * Modèle de lecture du dépôt : transforme des fichiers Markdown en entités
 * navigables (personnages, lieux, factions, chapitres) sans jamais réécrire
 * la source. Le dépôt reste la vérité ; ceci n'en est qu'une vue.
 *
 * Chaque instance vit le temps d'une requête et mémorise ses lectures, pour
 * qu'un même fichier ne soit jamais demandé deux fois dans la même page.
 */

import { arborescence, fichier } from "./github.js";
import { separer, tableau } from "./markdown.js";

const DOSSIERS = {
  canon: "00-canon",
  monde: "10-monde",
  systeme: "20-systeme",
  personnages: "30-personnages",
  chronologie: "40-chronologie",
  intrigue: "50-intrigue",
  manuscrit: "60-manuscrit",
  journal: "90-journal",
};

const estGabarit = (chemin) => chemin.split("/").pop().startsWith("_");

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

  /** Chemins Markdown d'un dossier, gabarits exclus. */
  async chemins(dossier) {
    const arbre = await this.arbre();
    return arbre
      .map((n) => n.chemin)
      .filter((c) => c.startsWith(dossier + "/") && c.endsWith(".md") && !estGabarit(c))
      .sort();
  }

  lire(chemin) {
    if (!this.memo.has(chemin)) this.memo.set(chemin, fichier(chemin, this.env));
    return this.memo.get(chemin);
  }

  /** Un fichier, découpé en en-tête et corps. */
  async fiche(chemin) {
    const source = await this.lire(chemin);
    const { meta, corps } = separer(source);
    return { chemin, meta, corps, source };
  }

  async fiches(dossier) {
    const chemins = await this.chemins(dossier);
    return Promise.all(chemins.map((c) => this.fiche(c)));
  }

  // ── entités ────────────────────────────────────────────────────────────────

  async personnages() {
    const fiches = await this.fiches(DOSSIERS.personnages);
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

  async chapitres() {
    const fiches = await this.fiches(DOSSIERS.manuscrit);
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

  /** Lieux et factions : fiches dédiées s'il en existe, sinon tables de synthèse. */
  async lieux() {
    const fiches = (await this.fiches(DOSSIERS.monde))
      .filter((f) => String(f.meta.id ?? "").startsWith("lie-"));
    if (fiches.length) return fiches.map(versEntite);
    const source = await this.lire(`${DOSSIERS.monde}/geographie.md`).catch(() => "");
    return tableau(source, "Lieux").map(depuisLigne("lie"));
  }

  async factions() {
    const fiches = (await this.fiches(DOSSIERS.monde))
      .filter((f) => String(f.meta.id ?? "").startsWith("fac-"));
    if (fiches.length) return fiches.map(versEntite);
    const source = await this.lire(`${DOSSIERS.monde}/factions.md`).catch(() => "");
    return tableau(source, "Grille par faction (`fac-xxx`)").map(depuisLigne("fac"));
  }

  async savoir() {
    const source = await this.lire(`${DOSSIERS.chronologie}/qui-sait-quoi.md`).catch(() => "");
    return {
      revelations: tableau(source, "Révélations"),
      table: tableau(source, "Table de savoir"),
      mensonges: tableau(source, "Mensonges actifs"),
    };
  }

  async promesses() {
    const source = await this.lire(`${DOSSIERS.intrigue}/promesses.md`).catch(() => "");
    const lignes = tableau(source);
    return lignes.map((l) => ({
      id: l.ID ?? "",
      texte: l.Promesse ?? "",
      type: l.Type ?? "",
      posee: l["Posée au"] ?? "",
      tenue: l["Tenue au"] ?? "",
      statut: l.Statut ?? (l["Tenue au"] ? "tenue" : "ouverte"),
    })).filter((p) => /^PRO-\d+$/.test(p.id) && !estGabaritDeTexte(p.texte));
  }

  async questionsOuvertes() {
    const source = await this.lire(`${DOSSIERS.canon}/QUESTIONS-OUVERTES.md`).catch(() => "");
    const enAttente = source.split(/^##\s+Tranch[ée]es\s*$/m)[0] ?? source;
    return [...enAttente.matchAll(/^###\s+(QO-\d+)\s+—\s+(.+)$/gm)]
      .map((m) => ({ id: m[1], titre: m[2].trim() }));
  }

  async journal() {
    const source = await this.lire(`${DOSSIERS.journal}/passes.md`).catch(() => "");
    // Le fichier documente son propre format dans un bloc de code : les titres
    // qui s'y trouvent sont un gabarit, pas des passes réelles.
    return [...sansBlocsDeCode(source).matchAll(/^##\s+(.+)$/gm)]
      .map((m) => m[1].trim())
      .filter((t) => !/^AAAA-MM-JJ/.test(t))
      .slice(0, 8);
  }

  async prochainePasse() {
    const source = await this.lire(`${DOSSIERS.journal}/PROCHAINE-PASSE.md`).catch(() => "");
    const statut = /^##\s*Statut\s*:\s*(.+)$/m.exec(source)?.[1]?.trim() ?? "inconnu";
    const objectif = section(source, "Objectif");
    return { statut, objectif: estGabaritDeTexte(objectif) ? "" : objectif, source };
  }

  /** Documents de fond, regroupés pour la navigation « Monde ». */
  async documents() {
    const arbre = await this.arbre();
    return arbre
      .map((n) => n.chemin)
      .filter((c) => c.endsWith(".md") && !estGabarit(c) &&
        [DOSSIERS.canon, DOSSIERS.monde, DOSSIERS.systeme,
         DOSSIERS.chronologie, DOSSIERS.intrigue].some((d) => c.startsWith(d + "/")))
      .sort();
  }
}

// ── outils ───────────────────────────────────────────────────────────────────

/** Les gabarits du dépôt emploient « _à définir_ », « _(vide)_ » : ce n'est pas du contenu. */
export const estGabaritDeTexte = (t) =>
  !t || /^_.*_$/.test(String(t).trim()) || /^\(?vide\)?$/i.test(String(t).trim());

const sansBlocsDeCode = (source) => String(source ?? "").replace(/```[\s\S]*?```/g, "");

const ORDRES = { protagoniste: 0, antagoniste: 1, secondaire: 2, figure: 3 };
const ordreRole = (r) => ORDRES[String(r).toLowerCase()] ?? 9;

function versEntite(f) {
  return {
    id: f.meta.id,
    nom: f.meta.nom ?? f.meta.id,
    statut: f.meta.statut ?? "",
    chemin: f.chemin,
    corps: f.corps,
    resume: premierParagraphe(f.corps),
  };
}

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
      aretes.push({
        de: p.id,
        vers: cible,
        nature: (ligne[cles[1]] ?? "").trim(),
      });
    }
  }
  return { sommets: personnages, aretes };
}
