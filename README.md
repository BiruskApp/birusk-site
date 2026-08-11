# Birusk

Site vitrine de **Birusk**, studio indépendant. Applications, sites internet et
identités, pour le Kurdistan et sa diaspora.

**[birusk.app](https://birusk.app)** — français, anglais, soranî.

Site statique, sans dépendance d'exécution ni de build, servi par un Worker
Cloudflare. Trois pages, environ 36 Ko chacune, tout compris.

---

## Principe

Trois fichiers se partagent le travail, et un seul rôle chacun :

| | |
|---|---|
| `content.json` | tout le texte, dans les trois langues |
| `template/` | la forme : page, styles, comportements |
| `build.mjs` | l'assemblage |

Le template ne connaît pas les langues. Toute valeur de la forme
`{ "fr": "…", "en": "…", "ckb": "…" }` rencontrée dans `content.json` est
résolue à la langue en cours avant que le template ne la voie. Ajouter une
langue revient donc à ajouter une clé, jamais à toucher au balisage.

## Démarrer

```sh
npm install          # wrangler uniquement, et seulement pour déployer
npm run dev          # http://localhost:4321, reconstruit à chaque modification
npm run build        # écrit dist/
npm run deploy       # construit puis publie sur Cloudflare
```

Le build prend une quinzaine de millisecondes. Il n'y a rien à attendre, rien
à mettre en cache, aucun outil à configurer.

## Modifier le contenu

Tout se passe dans `content.json`. Les sections suivent l'ordre de la page :
`hero`, `work`, `services`, `studio`, `contact`, `footer`.

```json
{
  "num": "02",
  "title": { "fr": "Sites internet", "en": "Websites", "ckb": "ماڵپەڕ" },
  "body": {
    "fr": "Rapides partout, y compris sur une connexion mobile à Hewlêr.",
    "en": "Fast everywhere, including on a mobile connection in Hewlêr.",
    "ckb": "خێرا لە هەموو شوێنێک، تەنانەت بە ئینتەرنێتی مۆبایل لە هەولێر."
  }
}
```

Si une traduction manque, le français prend le relais plutôt que de laisser un
trou dans la page.

## Le moteur de template

Un sous-ensemble volontairement réduit, suffisant pour un site de cette taille.

| Syntaxe | Effet |
|---|---|
| `{{valeur}}` | insère, en échappant le HTML |
| `{{{valeur}}}` | insère tel quel — réservé au CSS et au JS embarqués |
| `{{#if x}} … {{else}} … {{/if}}` | condition |
| `{{#unless x}} … {{/unless}}` | condition inverse |
| `{{#each liste}} … {{/each}}` | boucle, avec `{{@index}}`, `{{@first}}`, `{{@last}}` |
| `{{../x}}` | remonte d'un niveau de portée |

## Partis pris

**Aucune dépendance.** Ni framework, ni générateur tiers, ni chaîne de
compilation. Le seul paquet installé est `wrangler`, et uniquement pour publier.
Un site de cinq sections n'a pas besoin de plus, et ce qu'on n'installe pas ne
casse pas trois ans plus tard.

**Le poids d'abord.** CSS et JavaScript sont intégrés à la page : le navigateur
obtient tout ce dont il a besoin en une seule requête, ce qui compte davantage
qu'un cache partagé quand l'essentiel du trafic arrive par téléphone, parfois
sur un réseau lent.

**Les animations s'arrêtent d'elles-mêmes.** La boucle de rendu démarre à la
demande et rend la main dès qu'il n'y a plus rien à animer. Une animation qui
tourne en permanence vide une batterie sans que personne ne le remarque.
`prefers-reduced-motion` est respecté partout.

**L'écriture arabe est traitée comme telle.** En soranî, les lettres se lient
selon leur position dans le mot : les découper en balises individuelles pour
les animer casserait le mot. Le titre s'anime donc d'un bloc, et la mise en
page passe en `rtl`.

**Chaque langue ne charge que sa police.** Archivo et Kufi ne partagent aucun
glyphe. Les `unicode-range` évitent au navigateur de télécharger une fonte
qu'il n'utilisera pas, et chaque page ne précharge que la sienne — sans quoi
une page kurde téléchargerait 90 Ko de caractères latins pour rien.

## Structure

```
build.mjs        générateur : template, localisation, sitemap, 404
content.json     tout le texte, trilingue
template/
  page.html      la page
  style.css      styles
  app.js         comportements
assets/
  fonts/         Archivo (latin, latin étendu), Kufi (arabe)
  og-*.png       images de partage, une par langue
  logo.png
dist/            sortie du build, non versionnée
```

Les images de partage sont produites hors du dépôt et versées dans `assets/`
comme fichiers statiques : les régénérer est rare, et cela évite d'imposer une
dépendance de rendu à un build qui n'en a aucune.

## Déploiement

Le Worker ne sert que des fichiers, sans code serveur — les requêtes vers des
ressources statiques ne sont pas facturées.

```sh
npm run deploy
```

`wrangler.jsonc` déclare `birusk.app` et `www.birusk.app` en domaines
personnalisés ; Cloudflare crée et maintient les enregistrements DNS
correspondants.

## Licence

© Birusk. Tous droits réservés. Le code est publié pour consultation ; le
contenu, les textes et l'identité ne sont pas réutilisables sans accord.

Les polices font exception : **Archivo** et **Noto Kufi Arabic** sont publiées
sous SIL Open Font License 1.1 et restent libres selon ses termes. Voir
[`assets/fonts/LICENSE.txt`](assets/fonts/LICENSE.txt).
