/* birusk.app v2 — l'empilement est entièrement en CSS. Ce fichier ne sert
   qu'aux révélations à l'entrée dans le champ, et s'arrête aussitôt : chaque
   élément est cessé d'être observé dès qu'il est apparu. */

(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const marks = [...document.querySelectorAll(".up")];

  if (reduced) {
    marks.forEach((el) => el.classList.add("in"));
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      obs.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: .1 });

  marks.forEach((el) => io.observe(el));

  // L'ouverture est déjà visible au chargement : on ne la fait pas attendre
  // un événement de défilement qui pourrait ne jamais venir.
  requestAnimationFrame(() =>
    document.querySelectorAll(".open .up").forEach((el) => el.classList.add("in")));
})();
