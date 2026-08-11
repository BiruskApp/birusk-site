/* birusk.app v2 — le jeu de cartes.

   Une seule règle : la position dans le défilement donne un nombre à virgule,
   la carte entière pour l'index, la décimale pour la transition en cours. Tout
   le reste n'est que de la géométrie.

   Le calcul ne tourne qu'au défilement et s'arrête de lui-même : sur un
   téléphone, une boucle permanente coûte plus cher que tout le reste du site. */

(() => {
  "use strict";

  const rail = document.querySelector(".rail");
  if (!rail) return;

  const cards = [...rail.querySelectorAll(".card")];
  const count = cards.length;
  const label = document.querySelector(".count");

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = matchMedia("(max-width: 768px)");

  // Repli : en dessous de 769px la profondeur n'apporte rien et coûte cher,
  // et qui demande moins de mouvement ne veut pas d'un jeu qui s'anime.
  function flat() { return reduced || narrow.matches; }

  const DEPTH = 260;   // écart en Z entre deux cartes, en pixels
  const LIFT = 0.55;   // part de hauteur dont la carte sortante s'élève
  const VISIBLE = 3;   // cartes conservées derrière la première

  // ── défilement inertiel ────────────────────────────────────────────────────
  // Lenis interpole la position réelle du défilement : les évènements natifs
  // continuent donc d'être émis et les mesures restent justes. On ne l'active
  // pas si le visiteur demande moins de mouvement — l'inertie est exactement
  // ce qu'il refuse.
  const glide = !reduced && typeof globalThis.Lenis === "function"
    ? new globalThis.Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3) })
    : null;

  let running = false;

  function place() {
    const box = rail.getBoundingClientRect();
    const step = window.innerHeight;
    // p vaut 0 quand la première carte est en place, 1 quand la deuxième l'est
    const p = Math.min(Math.max(-box.top / step, 0), count - 1);

    cards.forEach((card, i) => {
      const d = i - p;

      if (d < -1 || d > VISIBLE) { card.style.visibility = "hidden"; return; }
      card.style.visibility = "visible";

      if (d < 0) {
        // carte sortante : elle s'élève et passe devant le spectateur
        const out = -d;
        card.style.transform = `translate3d(0, ${-out * LIFT * 100}%, ${out * 220}px)`;
        card.style.opacity = String(1 - out);
      } else {
        // carte en attente : elle remonte du fond, très légèrement décalée
        card.style.transform = `translate3d(0, ${d * 2}%, ${-d * DEPTH}px)`;
        card.style.opacity = "1";
      }
      card.style.zIndex = String(count - i);
    });

    if (label) label.textContent = String(Math.round(p) + 1).padStart(2, "0") + " / " + String(count).padStart(2, "0");
  }

  // La boucle ne tourne que tant qu'il se passe quelque chose : Lenis doit
  // être nourri image par image pendant qu'il glisse, mais rendre la main dès
  // qu'il s'immobilise. Une boucle permanente vide une batterie sans rien
  // apporter une fois le mouvement terminé.
  let last = 0;

  function frame(now) {
    if (glide) glide.raf(now);
    if (!flat()) place();
    if ((glide && glide.isScrolling) || now - last < 1200) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    last = performance.now();
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function mode() {
    if (flat()) {
      rail.classList.remove("rail--deck");
      cards.forEach((c) => { c.style.transform = ""; c.style.opacity = ""; c.style.visibility = ""; c.style.zIndex = ""; });
      if (label) label.textContent = "01 / " + String(count).padStart(2, "0");
    } else {
      rail.classList.add("rail--deck");
      place();
    }
  }

  rail.style.setProperty("--count", count);
  // La roue et le toucher sont écoutés en plus du défilement : Lenis retient
  // le geste avant que la page n'ait bougé, il faut donc réveiller la boucle
  // sur l'intention, pas seulement sur son résultat.
  for (const ev of ["scroll", "wheel", "touchstart", "touchmove", "keydown"])
    addEventListener(ev, wake, { passive: true });
  addEventListener("resize", () => { mode(); wake(); }, { passive: true });
  narrow.addEventListener("change", mode);
  mode();
})();
