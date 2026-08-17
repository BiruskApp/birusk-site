/**
 * Interface de /prv/romans.
 *
 * Espace de lecture privé : on y consulte les univers et les manuscrits, on ne
 * les modifie pas. Toute modification passe par le dépôt et par une proposition
 * validée. Aucune requête externe : mêmes polices auto-hébergées que le site
 * public, mêmes jetons de couleur.
 */

import { esc } from "./markdown.js";

export const R = "/prv/romans";

export const lienU = (u) => `${R}/u/${encodeURIComponent(u)}`;
export const lienO = (u, o) => `${lienU(u)}/o/${encodeURIComponent(o)}`;

const STYLE = `
@font-face{font-family:"Archivo";src:url("/assets/fonts/archivo-latin.woff2") format("woff2");
font-weight:100 900;font-stretch:62% 125%;font-display:swap;
unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2197,U+2212}
@font-face{font-family:"Archivo";src:url("/assets/fonts/archivo-latin-ext.woff2") format("woff2");
font-weight:100 900;font-stretch:62% 125%;font-display:swap;
unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+2C60-2C7F,U+A720-A7FF}

:root{
  --bg:#ffffff; --tint:#f5f5f6; --fg:#0d0d0e; --muted:#6b6b72;
  --rule:rgba(13,13,14,.12); --accent:#9d1b2f; --bright:#c8102e;
  --font:"Archivo","Helvetica Neue",Helvetica,Arial,sans-serif;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --pad:clamp(18px,4vw,56px);
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0d0d0e; --tint:#161618; --fg:#f2f2f3; --muted:#9b9ba3;
  --rule:rgba(242,242,243,.14); --accent:#e8536b; --bright:#ff6b81;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font);
  font-size:16px;line-height:1.6;font-synthesis:none;-webkit-font-smoothing:antialiased}
a{color:inherit}
h1,h2,h3,h4,h5,h6{line-height:1.2;font-weight:700;letter-spacing:-.015em;margin:1.8em 0 .6em}
h1{font-size:clamp(26px,5vw,40px);margin-top:0;letter-spacing:-.03em}
h2{font-size:clamp(19px,3vw,25px)}
h3{font-size:17px}
h4,h5,h6{font-size:15px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
p{margin:0 0 1em}
hr{border:0;border-top:1px solid var(--rule);margin:2.4em 0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;
  background:var(--tint);padding:.12em .4em;border-radius:4px}
pre{background:var(--tint);padding:16px;border-radius:8px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{margin:1.4em 0;padding:2px 0 2px 18px;border-left:2px solid var(--accent);color:var(--muted)}
.table-flottante{overflow-x:auto;margin:1.4em 0;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:14.5px;min-width:min(100%,520px)}
th,td{text-align:left;padding:9px 14px 9px 0;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:600;white-space:nowrap}
a.id{color:var(--accent);text-decoration:none;border-bottom:1px solid transparent}
a.id:hover{border-bottom-color:currentColor}

/* ── ossature ── */
.haut{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--rule)}
.haut .rang{display:flex;align-items:center;gap:12px;padding:10px var(--pad);max-width:1180px;margin:0 auto;
  flex-wrap:wrap}
.marque{font-weight:800;font-size:13px;letter-spacing:.1em;text-transform:uppercase;
  text-decoration:none;color:var(--accent);white-space:nowrap}
.fil{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--muted);min-width:0}
.fil a{text-decoration:none}
.fil a:hover{color:var(--fg)}
.fil b{font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
nav{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;margin-left:auto}
nav::-webkit-scrollbar{display:none}
nav a{text-decoration:none;font-size:13.5px;padding:6px 11px;border-radius:999px;
  color:var(--muted);white-space:nowrap;transition:background .15s,color .15s}
nav a:hover{color:var(--fg);background:var(--tint)}
nav a[aria-current]{color:var(--bg);background:var(--fg)}
main{max-width:1180px;margin:0 auto;padding:clamp(28px,5vw,56px) var(--pad) 96px}
.etroit{max-width:74ch}
footer{border-top:1px solid var(--rule);padding:22px var(--pad);color:var(--muted);
  font-size:12.5px;display:flex;gap:16px;flex-wrap:wrap;max-width:1180px;margin:0 auto}
footer a{color:var(--muted)}

/* ── éléments ── */
.chapo{color:var(--muted);font-size:clamp(15px,2vw,17px);max-width:66ch;margin:-.2em 0 2.4em}
.grille{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,268px),1fr));margin:0 0 40px}
.carte{display:block;text-decoration:none;border:1px solid var(--rule);border-radius:12px;
  padding:17px 18px;background:var(--bg);transition:border-color .15s,transform .15s}
.carte:hover{border-color:var(--accent);transform:translateY(-2px)}
.carte h3{margin:0 0 5px;font-size:17px}
.carte p{margin:0;color:var(--muted);font-size:13.5px;line-height:1.5}
.carte .sous{display:block;margin-top:9px;font-size:12px;color:var(--muted);
  text-transform:uppercase;letter-spacing:.05em}
.grande{grid-column:1/-1}
.rangee{display:flex;align-items:baseline;gap:12px;padding:13px 0;border-bottom:1px solid var(--rule);
  text-decoration:none}
.rangee:hover .titre{color:var(--accent)}
.rangee .num{font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px;min-width:2.6em}
.rangee .titre{font-weight:600}
.rangee .fin{margin-left:auto;color:var(--muted);font-size:12.5px;white-space:nowrap}
.puce{display:inline-block;font-size:11px;letter-spacing:.05em;text-transform:uppercase;
  padding:2px 8px;border-radius:999px;background:var(--tint);color:var(--muted);font-weight:600}
.puce.vif{background:var(--accent);color:#fff}
.puce.douce{border:1px solid var(--rule);background:none}
.chiffres{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(126px,1fr));margin:0 0 44px}
.chiffre{border:1px solid var(--rule);border-radius:12px;padding:15px 16px}
.chiffre b{display:block;font-size:27px;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.chiffre span{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.avis{border:1px solid var(--rule);border-left:3px solid var(--accent);border-radius:8px;
  padding:16px 18px;margin:0 0 34px;background:var(--tint)}
.avis p:last-child{margin:0}
.meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:13px;margin:0 0 26px}
.deux{display:grid;gap:clamp(28px,5vw,56px);grid-template-columns:1fr}
@media(min-width:920px){.deux{grid-template-columns:minmax(0,1fr) 288px}}
.flanc{font-size:14px}
.flanc h4{margin-top:0}
.flanc ul{list-style:none;padding:0;margin:0 0 26px}
.flanc li{padding:5px 0;border-bottom:1px solid var(--rule)}
.texte{font-family:var(--serif);font-size:clamp(17.5px,2.2vw,19.5px);line-height:1.72;max-width:68ch}
.texte p{margin:0 0 1.15em;text-align:justify;hyphens:auto}
.texte h2,.texte h3{font-family:var(--font)}
.vide{border:1px dashed var(--rule);border-radius:12px;padding:34px;text-align:center;color:var(--muted)}
.retour{display:inline-block;text-decoration:none;color:var(--muted);font-size:13px;margin:0 0 20px}
.retour:hover{color:var(--accent)}
.graphe{width:100%;height:auto;overflow:visible}
.graphe text{font-family:var(--font);font-size:11px;fill:var(--fg)}
.graphe line{stroke:var(--rule);stroke-width:1.4}
.graphe circle{fill:var(--bg);stroke:var(--accent);stroke-width:2;transition:fill .15s}
.graphe a:hover circle{fill:var(--accent)}

/* ── connexion ── */
.porte{min-height:100svh;display:grid;place-items:center;padding:26px}
.porte form{width:100%;max-width:330px;text-align:center}
.porte h1{font-size:23px;margin-bottom:6px}
.porte p{color:var(--muted);font-size:14px;margin-bottom:26px}
.porte input{width:100%;font-family:var(--font);font-size:16px;padding:13px 15px;
  border:1px solid var(--rule);border-radius:10px;background:var(--bg);color:var(--fg);
  text-align:center;letter-spacing:.04em}
.porte input:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:transparent}
.porte button{width:100%;margin-top:11px;font-family:var(--font);font-size:13px;font-weight:700;
  text-transform:uppercase;letter-spacing:.08em;padding:13px;border:0;border-radius:10px;
  background:var(--accent);color:#fff;cursor:pointer}
.porte button:hover{background:var(--bright)}
.erreur{color:var(--accent);font-size:13.5px;margin-top:16px;min-height:1.2em}
`;

// ── ossature ────────────────────────────────────────────────────────────────

/**
 * @param {object} ou  contexte de lecture : { univers:{nom,titre}, oeuvre:{nom,titre} }
 *                     Il détermine le fil d'Ariane et les onglets disponibles.
 */
function navigation(ou, actif) {
  const entrees = [];
  if (ou?.univers) {
    const u = ou.univers.nom;
    entrees.push([lienU(u), "Univers", "univers"]);
    if (ou.oeuvre) {
      const o = ou.oeuvre.nom;
      entrees.push([`${lienO(u, o)}/chapitres`, "Chapitres", "chapitres"]);
    }
    entrees.push(
      [`${lienU(u)}/personnages`, "Personnages", "personnages"],
      [`${lienU(u)}/lieux`, "Lieux", "lieux"],
      [`${lienU(u)}/relations`, "Relations", "relations"],
      [`${lienU(u)}/monde`, "Monde", "monde"],
    );
  } else {
    entrees.push([R, "Accueil", "accueil"]);
  }
  entrees.push([`${R}/propositions`, "Propositions", "propositions"]);
  return entrees.map(([voie, nom, cle]) =>
    `<a href="${voie}"${cle === actif ? ' aria-current="page"' : ""}>${nom}</a>`).join("");
}

function fil(ou) {
  if (!ou?.univers) return "";
  const u = ou.univers;
  const morceaux = [`<a href="${R}">Tous les univers</a>`, "›",
                    `<b><a href="${lienU(u.nom)}">${esc(u.titre)}</a></b>`];
  if (ou.oeuvre) {
    morceaux.push("›", `<b>${esc(ou.oeuvre.titre)}</b>`);
  }
  return `<div class="fil">${morceaux.join(" ")}</div>`;
}

export function page({ titre, actif = "", contenu, ou = null }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#9d1b2f">
<title>${esc(titre)} — Romans</title><style>${STYLE}</style></head><body>
<header class="haut"><div class="rang">
<a class="marque" href="${R}">Romans</a>
${fil(ou)}
<nav>${navigation(ou, actif)}</nav>
</div></header>
<main>${contenu}</main>
<footer><span>Espace privé — lecture seule ; toute modification passe par une proposition.</span>
<a href="${R}/sortie">Se déconnecter</a></footer>
</body></html>`;
}

export const connexion = (message = "") => `<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="light dark">
<title>Accès privé</title><style>${STYLE}</style></head><body><div class="porte">
<form method="post" action="${R}/entree">
<h1>Romans</h1><p>Espace privé. Code d'accès requis.</p>
<input type="password" name="code" autocomplete="current-password" autofocus
 inputmode="text" aria-label="Code d'accès" placeholder="Code d'accès">
<button type="submit">Entrer</button>
<p class="erreur">${esc(message)}</p>
</form></div></body></html>`;

// ── fragments ───────────────────────────────────────────────────────────────

const puce = (texte, style = "") =>
  texte ? `<span class="puce ${style}">${esc(texte)}</span>` : "";

const vide = (message) => `<div class="vide">${esc(message)}</div>`;

const retour = (voie, nom) => `<a class="retour" href="${voie}">← ${esc(nom)}</a>`;

const nombre = (n) => (n || 0).toLocaleString("fr-FR");

export const erreur = (message, indication = "") => page({
  titre: "Indisponible",
  contenu: `<h1>Le dépôt n'est pas lisible</h1>
<p class="chapo">${esc(message)}</p>${indication ? `<div class="avis"><p>${indication}</p></div>` : ""}`,
});

// ── accueil : tous les univers ──────────────────────────────────────────────

export function accueil({ univers, passe, journal, prs }) {
  const gele = /EN ATTENTE/i.test(passe.statut);
  return page({ titre: "Univers", actif: "accueil", contenu: `
<h1>Univers</h1>
<p class="chapo">Chaque univers a son canon — monde, système, personnages,
chronologie — partagé par tous les livres qui s'y déroulent. Deux univers sont
étanches : rien ne passe de l'un à l'autre.</p>

${gele ? `<div class="avis"><p><strong>Chantier gelé.</strong> ${esc(passe.statut)} —
aucune écriture n'est autorisée tant que le brief du premier roman n'a pas été
fourni. C'est volontaire : cela empêche une passe automatique d'inventer un
univers avant que vous ayez décidé lequel.</p></div>` : ""}

${univers.length ? `<div class="grille">${univers.map((u) => `
<a class="carte" href="${lienU(u.nom)}">
  <h3>${esc(u.titre)}</h3>
  <p>${esc(u.resume).slice(0, 150)}</p>
  <span class="sous">${u.oeuvres.length} œuvre${u.oeuvres.length > 1 ? "s" : ""}${
    u.oeuvres.length ? " · " + u.oeuvres.map((o) => esc(o.titre)).join(", ") : ""}</span>
</a>`).join("")}</div>`
    : vide("Aucun univers. Le premier sera créé dès que le brief sera fourni.")}

${prs.length ? `<h2>Propositions à relire</h2>
${prs.slice(0, 5).map((p) => `<a class="rangee" href="${R}/propositions#pr-${p.numero}">
<span class="num">#${p.numero}</span><span class="titre">${esc(p.titre)}</span>
<span class="fin">${p.brouillon ? "brouillon" : "prête"}</span></a>`).join("")}` : ""}

${journal.length ? `<h2>Journal du dépôt</h2>
<ul class="flanc">${journal.map((j) => `<li>${esc(j)}</li>`).join("")}</ul>` : ""}
` });
}

// ── tableau de bord d'un univers ────────────────────────────────────────────

export function tableauUnivers(u, { oeuvres, personnages, chapitres, questions, html }) {
  const mots = chapitres.reduce((n, c) => n + (c.mots || 0), 0);
  return page({ titre: u.titre, actif: "univers", ou: { univers: u }, contenu: `
<h1>${esc(u.titre)}</h1>
${u.resume ? `<p class="chapo">${esc(u.resume)}</p>` : ""}

<div class="chiffres">
  <div class="chiffre"><b>${oeuvres.length}</b><span>Œuvres</span></div>
  <div class="chiffre"><b>${chapitres.length}</b><span>Chapitres</span></div>
  <div class="chiffre"><b>${nombre(mots)}</b><span>Mots</span></div>
  <div class="chiffre"><b>${personnages.length}</b><span>Personnages</span></div>
</div>

${questions.length ? `<h2>En attente de votre arbitrage</h2>
<div class="avis"><p>Un agent s'est arrêté sur ${questions.length === 1 ? "cette question" : "ces questions"}
plutôt que de trancher seul.</p></div>
${questions.map((q) => `<div class="rangee"><span class="num">${esc(q.id.replace("QO-", ""))}</span>
<span class="titre">${esc(q.titre)}</span></div>`).join("")}` : ""}

<h2>Œuvres</h2>
${oeuvres.length ? `<div class="grille">${oeuvres.map((o) => `
<a class="carte" href="${lienO(u.nom, o.nom)}">
  <h3>${esc(o.titre)}</h3>
  <p>${esc(o.resume).slice(0, 150)}</p>
  <span class="sous">${o.ordre ? `Tome ${o.ordre} · ` : ""}${esc(o.statut)}</span>
</a>`).join("")}</div>`
    : vide("Aucune œuvre dans cet univers. Le canon peut se construire avant le premier livre.")}

${html ? `<h2>À propos de cet univers</h2><div class="etroit">${html}</div>` : ""}
` });
}

// ── tableau de bord d'une œuvre ─────────────────────────────────────────────

export function tableauOeuvre(u, o, { chapitres, promesses, html }) {
  const mots = chapitres.reduce((n, c) => n + (c.mots || 0), 0);
  const ouvertes = promesses.filter((p) => !p.tenue);
  return page({ titre: o.titre, actif: "univers", ou: { univers: u, oeuvre: o }, contenu: `
<h1>${esc(o.titre)}</h1>
<div class="meta">${o.ordre ? `<span>Tome ${o.ordre}</span>` : ""}${puce(o.statut, "douce")}</div>
${o.resume ? `<p class="chapo">${esc(o.resume)}</p>` : ""}

<div class="chiffres">
  <div class="chiffre"><b>${chapitres.length}</b><span>Chapitres</span></div>
  <div class="chiffre"><b>${nombre(mots)}</b><span>Mots</span></div>
  <div class="chiffre"><b>${ouvertes.length}</b><span>Promesses ouvertes</span></div>
</div>

${chapitres.length ? `<h2>Manuscrit</h2>
${chapitres.slice(0, 8).map((c) => `<a class="rangee" href="${lienO(u.nom, o.nom)}/chapitres/${esc(c.id)}">
<span class="num">${c.numero || "—"}</span><span class="titre">${esc(c.titre)}</span>
<span class="fin">${nombre(c.mots)} mots</span></a>`).join("")}
${chapitres.length > 8 ? `<p style="margin-top:18px"><a class="id" href="${lienO(u.nom, o.nom)}/chapitres">Voir les ${chapitres.length} chapitres →</a></p>` : ""}`
    : vide("Le manuscrit n'a pas commencé.")}

${ouvertes.length ? `<h2>Promesses ouvertes</h2>
<div class="table-flottante"><table><thead><tr><th>Promesse</th><th>Type</th><th>Posée au</th></tr></thead>
<tbody>${ouvertes.map((p) => `<tr><td>${esc(p.texte)}</td><td>${esc(p.type)}</td><td>${esc(p.posee)}</td></tr>`).join("")}
</tbody></table></div>` : ""}

${html ? `<h2>À propos de ce livre</h2><div class="etroit">${html}</div>` : ""}
` });
}

// ── chapitres ───────────────────────────────────────────────────────────────

export function listeChapitres(u, o, chapitres, nom) {
  return page({ titre: `${o.titre} — chapitres`, actif: "chapitres",
    ou: { univers: u, oeuvre: o }, contenu: `
<h1>Chapitres</h1>
<p class="chapo">${chapitres.length ? `${chapitres.length} chapitre${chapitres.length > 1 ? "s" : ""}, ` +
    `${nombre(chapitres.reduce((n, c) => n + (c.mots || 0), 0))} mots.`
    : "Le manuscrit n'a pas commencé."}</p>
${chapitres.length ? chapitres.map((c) => `<a class="rangee" href="${lienO(u.nom, o.nom)}/chapitres/${esc(c.id)}">
<span class="num">${c.numero || "—"}</span>
<span class="titre">${esc(c.titre)}</span>
<span class="fin">${c.pov ? esc(nom(c.pov)) + " · " : ""}${nombre(c.mots)} mots · ${esc(c.statut)}</span>
</a>`).join("") : vide("Aucun chapitre. Le manuscrit commencera une fois le canon posé.")}
` });
}

export function unChapitre(u, o, c, { html, nom, precedent, suivant }) {
  const base = lienO(u.nom, o.nom);
  return page({ titre: c.titre, actif: "chapitres", ou: { univers: u, oeuvre: o }, contenu: `
${retour(`${base}/chapitres`, "Chapitres")}
<div class="deux"><div>
<h1>${esc(c.titre)}</h1>
<div class="meta">
  <span>Chapitre ${c.numero || "—"}</span>
  ${c.partie ? `<span>Partie ${esc(String(c.partie))}</span>` : ""}
  ${c.pov ? `<span>Point de vue : ${esc(nom(c.pov))}</span>` : ""}
  ${c.date ? `<span>${esc(String(c.date))}</span>` : ""}
  ${puce(c.statut, c.statut === "valide" ? "vif" : "douce")}
</div>
<div class="texte">${html}</div>
<div class="meta" style="margin-top:44px">
  ${precedent ? `<a href="${base}/chapitres/${esc(precedent.id)}">← ${esc(precedent.titre)}</a>` : ""}
  ${suivant ? `<a href="${base}/chapitres/${esc(suivant.id)}" style="margin-left:auto">${esc(suivant.titre)} →</a>` : ""}
</div>
</div><aside class="flanc">
${c.personnages.length ? `<h4>Présents</h4><ul>${c.personnages.map((p) =>
    `<li><a class="id" href="${lienU(u.nom)}/personnages/${esc(p)}">${esc(nom(p))}</a></li>`).join("")}</ul>` : ""}
${c.lieux.length ? `<h4>Lieux</h4><ul>${c.lieux.map((l) => `<li>${esc(nom(l))}</li>`).join("")}</ul>` : ""}
${c.revelations.length ? `<h4>Révélations</h4><ul>${c.revelations.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
${c.promessesPosees.length ? `<h4>Promesses posées</h4><ul>${c.promessesPosees.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
${c.promessesTenues.length ? `<h4>Promesses tenues</h4><ul>${c.promessesTenues.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
</aside></div>
` });
}

// ── personnages ─────────────────────────────────────────────────────────────

export function listePersonnages(u, personnages) {
  return page({ titre: "Personnages", actif: "personnages", ou: { univers: u }, contenu: `
<h1>Personnages</h1>
<p class="chapo">${personnages.length
    ? "Fiches complètes : désir, peur, voix, arc, relations. Un personnage appartient à l'univers et peut traverser plusieurs livres."
    : "Aucun personnage n'a encore été canonisé dans cet univers."}</p>
${personnages.length ? `<div class="grille">${personnages.map((p) => `
<a class="carte" href="${lienU(u.nom)}/personnages/${esc(p.id)}">
  <h3>${esc(p.nom)}</h3>
  <p>${puce(p.role, p.role === "protagoniste" ? "vif" : "")} ${esc(p.resume).slice(0, 130)}</p>
</a>`).join("")}</div>` : vide("Les fiches apparaîtront ici dès que le premier personnage sera canonisé.")}
` });
}

export function unPersonnage(u, p, { html, apparitions, liens, nom, savoir }) {
  return page({ titre: p.nom, actif: "personnages", ou: { univers: u }, contenu: `
${retour(`${lienU(u.nom)}/personnages`, "Personnages")}
<div class="deux"><div>
<h1>${esc(p.nom)}</h1>
<div class="meta">${puce(p.role, "douce")}${puce(p.statut, "douce")}
${p.premiere ? `<span>Première apparition : ${esc(String(p.premiere))}</span>` : ""}</div>
<div class="etroit">${html}</div>
</div><aside class="flanc">
${liens.length ? `<h4>Liens</h4><ul>${liens.map((l) =>
    `<li><a class="id" href="${lienU(u.nom)}/personnages/${esc(l.id)}">${esc(nom(l.id))}</a>
     ${l.nature ? `<br><span style="color:var(--muted);font-size:12.5px">${esc(l.nature)}</span>` : ""}</li>`).join("")}</ul>` : ""}
${apparitions.length ? `<h4>Apparaît dans</h4><ul>${apparitions.map((c) =>
    `<li><a class="id" href="${lienO(u.nom, c.oeuvre)}/chapitres/${esc(c.id)}">${esc(c.titreOeuvre)} — ${c.numero || "—"} · ${esc(c.titre)}</a></li>`).join("")}</ul>` : ""}
${savoir.length ? `<h4>Sait</h4><ul>${savoir.map((s) =>
    `<li>${esc(s.revelation)} <span style="color:var(--muted)">— ch. ${esc(s.chapitre || "?")}, ${esc(s.etat)}</span></li>`).join("")}</ul>` : ""}
<h4>Source</h4><ul><li><a class="id" href="${esc(p.lienDepot)}" target="_blank" rel="noopener">Fiche dans le dépôt ↗</a></li></ul>
</aside></div>
` });
}

// ── lieux et factions ───────────────────────────────────────────────────────

export function listeLieux(u, lieux, factions) {
  const bloc = (titre, liste, message) => `<h2>${titre}</h2>
${liste.length ? `<div class="grille">${liste.map((e) => `
<div class="carte"><h3>${esc(e.nom)}</h3><p>${esc(e.resume).slice(0, 150)}</p></div>`).join("")}</div>`
    : vide(message)}`;
  return page({ titre: "Lieux et factions", actif: "lieux", ou: { univers: u }, contenu: `
<h1>Lieux et factions</h1>
<p class="chapo">La carte n'est pas un décor : elle explique qui est riche, qui a faim,
et pourquoi la guerre a lieu ici plutôt qu'ailleurs.</p>
${bloc("Lieux", lieux, "Aucun lieu canonisé.")}
${bloc("Factions", factions, "Aucune faction canonisée.")}
` });
}

// ── relations ───────────────────────────────────────────────────────────────

export function relations(u, { sommets, aretes }) {
  if (!sommets.length) {
    return page({ titre: "Relations", actif: "relations", ou: { univers: u },
      contenu: `<h1>Relations</h1>${vide("Le graphe se dessinera dès qu'il y aura des personnages.")}` });
  }

  const n = sommets.length;
  const taille = 600;
  const centre = taille / 2;
  const rayon = Math.min(centre - 96, 60 + n * 16);
  const position = sommets.map((p, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { id: p.id, nom: p.nom, x: centre + rayon * Math.cos(angle),
             y: centre + rayon * Math.sin(angle), angle };
  });
  const par = Object.fromEntries(position.map((p) => [p.id, p]));

  const traits = aretes.map((a) => {
    const d = par[a.de], v = par[a.vers];
    if (!d || !v) return "";
    return `<line x1="${d.x.toFixed(1)}" y1="${d.y.toFixed(1)}" x2="${v.x.toFixed(1)}" y2="${v.y.toFixed(1)}"><title>${esc(a.nature || "lien")}</title></line>`;
  }).join("");

  const noeuds = position.map((p) => {
    const droite = Math.cos(p.angle) > -0.01;
    const dx = droite ? 15 : -15;
    return `<a href="${lienU(u.nom)}/personnages/${esc(p.id)}">
<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6"></circle>
<text x="${(p.x + dx).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="${droite ? "start" : "end"}">${esc(p.nom)}</text>
</a>`;
  }).join("");

  return page({ titre: "Relations", actif: "relations", ou: { univers: u }, contenu: `
<h1>Relations</h1>
<p class="chapo">${aretes.length} lien${aretes.length > 1 ? "s" : ""} entre ${n} personnage${n > 1 ? "s" : ""},
reconstruits depuis les tables « Relations » de chaque fiche. Touchez un nom pour ouvrir sa fiche.</p>
<svg class="graphe" viewBox="0 0 ${taille} ${taille}" role="img" aria-label="Graphe des relations">
${traits}${noeuds}</svg>
${aretes.length ? `<h2>Détail</h2><div class="table-flottante"><table><thead><tr>
<th>Personnage</th><th>Lien</th><th>Nature</th></tr></thead><tbody>
${aretes.map((a) => `<tr><td>${esc(par[a.de]?.nom ?? a.de)}</td><td>${esc(par[a.vers]?.nom ?? a.vers)}</td>
<td>${esc(a.nature)}</td></tr>`).join("")}</tbody></table></div>` : ""}
` });
}

// ── monde et documents ──────────────────────────────────────────────────────

const JOLI = {
  "00-canon": "Canon", "10-monde": "Monde", "20-systeme": "Système",
  "40-chronologie": "Chronologie", "50-intrigue": "Intrigue",
};

export function monde(u, documents) {
  const groupes = {};
  for (const chemin of documents) {
    const dossier = chemin.split("/")[2];      // univers/<nom>/<dossier>/…
    (groupes[JOLI[dossier] ?? dossier] ??= []).push(chemin);
  }
  return page({ titre: "Monde", actif: "monde", ou: { univers: u }, contenu: `
<h1>Le monde</h1>
<p class="chapo">Les fiches techniques : invariants, règles dures du système, société,
chronologie. C'est le socle que tous les livres de cet univers ne peuvent pas contredire.</p>
${Object.entries(groupes).map(([titre, liste]) => `<h2>${esc(titre)}</h2>
<div class="grille">${liste.map((chemin) => {
    const nom = chemin.split("/").pop().replace(/\.md$/, "").replace(/-/g, " ");
    return `<a class="carte" href="${lienU(u.nom)}/doc/${liste_encode(chemin)}"><h3>${esc(nom)}</h3>
<p>${esc(chemin.split("/").slice(2).join("/"))}</p></a>`;
  }).join("")}</div>`).join("")}
` });
}

const liste_encode = (chemin) => chemin.split("/").map(encodeURIComponent).join("/");

export const document_ = (u, titre, html, chemin, lien) => page({
  titre, actif: "monde", ou: { univers: u }, contenu: `
${retour(`${lienU(u.nom)}/monde`, "Monde")}
<div class="etroit"><h1>${esc(titre)}</h1>
<div class="meta"><a href="${esc(lien)}" target="_blank" rel="noopener">${esc(chemin)} ↗</a></div>
${html}</div>` });

// ── propositions ────────────────────────────────────────────────────────────

export function propositions(liste, rendreCorps) {
  return page({ titre: "Propositions", actif: "propositions", contenu: `
<h1>Propositions</h1>
<p class="chapo">Le travail des passes automatiques, en attente de votre validation.
Rien n'entre dans le canon avant que vous ayez tranché.</p>
${liste.length ? liste.map((p) => `<section id="pr-${p.numero}" style="margin:0 0 44px">
<h2>#${p.numero} — ${esc(p.titre)} ${p.brouillon ? puce("brouillon") : ""}</h2>
<div class="meta"><span>${esc(p.auteur)}</span><span>${esc(p.branche)}</span>
<span>${esc(new Date(p.majAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }))}</span>
<a href="${esc(p.lien)}" target="_blank" rel="noopener">Ouvrir sur GitHub pour valider ↗</a></div>
<div class="etroit">${rendreCorps(p.corps)}</div>
</section>`).join("")
    : vide("Aucune proposition en attente. Tout est fusionné.")}
` });
}
