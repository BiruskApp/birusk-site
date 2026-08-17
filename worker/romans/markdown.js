/**
 * Rendu Markdown — sous-ensemble volontairement restreint à ce que le dépôt
 * emploie réellement : titres, paragraphes, listes, tableaux, citations, code,
 * emphase, liens. Tout est échappé avant d'être formaté ; aucun HTML brut du
 * dépôt n'atteint la page.
 */

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Découpe l'en-tête YAML d'un fichier. Sous-ensemble : scalaires, listes en ligne. */
export function separer(texte) {
  const source = String(texte ?? "");
  if (!source.startsWith("---")) return { meta: {}, corps: source };
  const fin = source.indexOf("\n---", 3);
  if (fin === -1) return { meta: {}, corps: source };
  const meta = {};
  for (const ligne of source.slice(4, fin).split("\n")) {
    const propre = ligne.trim();
    if (!propre || propre.startsWith("#") || !propre.includes(":")) continue;
    const [cle, ...reste] = propre.split(":");
    meta[cle.trim()] = valeur(reste.join(":").trim().replace(/\s+#.*$/, ""));
  }
  const corps = source.slice(source.indexOf("\n", fin + 1) + 1);
  return { meta, corps };
}

function valeur(brut) {
  if (brut.startsWith("[") && brut.endsWith("]")) {
    const dedans = brut.slice(1, -1).trim();
    return dedans ? dedans.split(",").map((e) => e.trim().replace(/^['"]|['"]$/g, "")) : [];
  }
  if (brut === "null" || brut === "~" || brut === "") return null;
  if (/^-?\d+$/.test(brut)) return Number(brut);
  return brut.replace(/^['"]|['"]$/g, "");
}

// ── inline ───────────────────────────────────────────────────────────────────

function enligne(texte, lien) {
  let s = esc(texte);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  // Liens markdown, puis identifiants du canon transformés en liens internes.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, texte_, cible) =>
    /^https?:\/\//.test(cible)
      ? `<a href="${esc(cible)}" rel="noopener" target="_blank">${texte_}</a>`
      : `<a href="${esc(lien?.interne?.(cible) ?? "#")}">${texte_}</a>`);
  if (lien?.identifiant) {
    s = s.replace(/\b((?:per|lie|fac|cha|sys|mon)-[a-z0-9-]+)\b/g, (m, id) => {
      const cible = lien.identifiant(id);
      return cible ? `<a class="id" href="${esc(cible)}">${m}</a>` : `<code>${m}</code>`;
    });
  }
  return s;
}

// ── blocs ────────────────────────────────────────────────────────────────────

/**
 * @param {string} source  markdown (sans en-tête)
 * @param {object} lien    { identifiant(id) -> url|null, interne(chemin) -> url }
 */
export function rendre(source, lien = {}) {
  const lignes = String(source ?? "").split("\n");
  const sortie = [];
  let i = 0;

  const paragraphe = [];
  const viderParagraphe = () => {
    if (paragraphe.length) {
      sortie.push(`<p>${enligne(paragraphe.join(" "), lien)}</p>`);
      paragraphe.length = 0;
    }
  };

  while (i < lignes.length) {
    const ligne = lignes[i];
    const nue = ligne.trim();

    if (!nue) { viderParagraphe(); i++; continue; }

    // bloc de code
    if (nue.startsWith("```")) {
      viderParagraphe();
      const bloc = [];
      i++;
      while (i < lignes.length && !lignes[i].trim().startsWith("```")) bloc.push(lignes[i++]);
      i++;
      sortie.push(`<pre><code>${esc(bloc.join("\n"))}</code></pre>`);
      continue;
    }

    // titre
    const titre = /^(#{1,6})\s+(.*)$/.exec(nue);
    if (titre) {
      viderParagraphe();
      const niveau = Math.min(titre[1].length + 1, 6);   // h1 est réservé à la page
      sortie.push(`<h${niveau}>${enligne(titre[2], lien)}</h${niveau}>`);
      i++;
      continue;
    }

    // filet
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(nue)) {
      viderParagraphe(); sortie.push("<hr>"); i++; continue;
    }

    // tableau
    if (nue.startsWith("|") && /^\s*\|[\s:|-]+\|\s*$/.test(lignes[i + 1] ?? "")) {
      viderParagraphe();
      const cellules = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const entetes = cellules(nue);
      i += 2;
      const corps = [];
      while (i < lignes.length && lignes[i].trim().startsWith("|")) corps.push(cellules(lignes[i++]));
      sortie.push(
        `<div class="table-flottante"><table><thead><tr>` +
        entetes.map((c) => `<th>${enligne(c, lien)}</th>`).join("") +
        `</tr></thead><tbody>` +
        corps.map((r) => `<tr>${r.map((c) => `<td>${enligne(c, lien)}</td>`).join("")}</tr>`).join("") +
        `</tbody></table></div>`,
      );
      continue;
    }

    // citation
    if (nue.startsWith(">")) {
      viderParagraphe();
      const bloc = [];
      while (i < lignes.length && lignes[i].trim().startsWith(">")) {
        bloc.push(lignes[i++].trim().replace(/^>\s?/, ""));
      }
      sortie.push(`<blockquote>${rendre(bloc.join("\n"), lien)}</blockquote>`);
      continue;
    }

    // listes
    const puce = /^([-*+]|\d+\.)\s+(.*)$/.exec(nue);
    if (puce) {
      viderParagraphe();
      const ordonnee = /\d/.test(puce[1]);
      const elements = [];
      while (i < lignes.length) {
        const suite = /^([-*+]|\d+\.)\s+(.*)$/.exec(lignes[i].trim());
        if (!suite) {
          // continuation indentée d'un élément
          if (elements.length && /^\s{2,}\S/.test(lignes[i])) {
            elements[elements.length - 1] += " " + lignes[i].trim();
            i++;
            continue;
          }
          break;
        }
        elements.push(suite[2]);
        i++;
      }
      const balise = ordonnee ? "ol" : "ul";
      sortie.push(`<${balise}>${elements.map((e) => `<li>${enligne(e, lien)}</li>`).join("")}</${balise}>`);
      continue;
    }

    paragraphe.push(nue);
    i++;
  }
  viderParagraphe();
  return sortie.join("\n");
}

/** Extrait les lignes utiles d'un tableau markdown, en ignorant les gabarits. */
export function tableau(source, titreSection = null) {
  let texte = String(source ?? "");
  if (titreSection) {
    const debut = texte.search(new RegExp(`^#{1,6}\\s+${titreSection}\\s*$`, "mi"));
    if (debut === -1) return [];
    const reste = texte.slice(debut);
    const fin = reste.slice(1).search(/^#{1,6}\s+/m);
    texte = fin === -1 ? reste : reste.slice(0, fin + 1);
  }
  const lignes = texte.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lignes.length < 2) return [];
  const decouper = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const entetes = decouper(lignes[0]);
  return lignes.slice(2)
    .map(decouper)
    .filter((r) => r.some((c) => c && c !== "—" && !/^_.*_$/.test(c)))
    .map((r) => Object.fromEntries(entetes.map((e, n) => [e, r[n] ?? ""])));
}
