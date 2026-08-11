/* birusk.app v2 — la roue.

   Chaque carte est une cabine placée sur un cercle vertical. Pour un écart d
   entre sa position et celle du défilement, l'angle vaut d × PAS ; le reste
   n'est que trigonométrie :

     y = R·sin(a)        elle monte ou descend le long du cercle
     z = R·(cos(a) − 1)  elle s'éloigne à mesure qu'elle quitte le devant
     rotateX = −a        elle reste tangente au cercle, donc s'écrase de profil

   La carte de devant a un angle nul : ni décalage, ni rotation, ni recul.
   C'est ce qui la fige exactement au même endroit, carte après carte. */

(() => {
  "use strict";

  const wheel = document.querySelector(".wheel");
  const rail = document.querySelector(".rail");
  if (!wheel || !rail) return;

  const slots = [...wheel.querySelectorAll(".slot")];
  const dots = [...document.querySelectorAll(".dots i")];
  const count = slots.length;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = matchMedia("(max-width: 900px)");
  const flat = () => narrow.matches;

  const R = 38;        // rayon de la roue, en rem
  const STEP = 68;     // angle entre deux cabines, en degrés
  const SEEN = 2;      // cabines conservées de part et d'autre
  const rad = (deg) => (deg * Math.PI) / 180;

  const glide = !reduced && !flat() && typeof globalThis.Lenis === "function"
    ? new globalThis.Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3) })
    : null;

  let running = false, last = 0, shown = -1;

  function place() {
    const p = Math.min(Math.max(scrollY / innerHeight, 0), count - 1);

    slots.forEach((slot, i) => {
      const d = i - p;
      if (Math.abs(d) > SEEN) { slot.style.visibility = "hidden"; return; }
      slot.style.visibility = "visible";

      const a = rad(d * STEP);
      const y = R * Math.sin(a);
      const z = R * (Math.cos(a) - 1);
      slot.style.transform = `translate3d(0, ${y}rem, ${z}rem) rotateX(${-d * STEP}deg)`;
      // la cabine du devant reste pleinement opaque, les autres s'effacent
      slot.style.opacity = String(Math.max(0, 1 - Math.abs(d) * 0.3));
      slot.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
    });

    const near = Math.round(p);
    if (near !== shown) {
      shown = near;
      dots.forEach((dot, i) => dot.classList.toggle("on", i === near));
    }
  }

  function frame(now) {
    if (glide) glide.raf(now);
    if (!flat()) place();
    if ((glide && glide.isScrolling) || now - last < 1200) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    last = performance.now();
    if (running || flat()) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function mode() {
    if (flat()) {
      slots.forEach((s) => { s.style.transform = ""; s.style.opacity = ""; s.style.visibility = ""; });
    } else {
      place();
    }
  }

  rail.style.setProperty("--count", count);
  for (const ev of ["scroll", "wheel", "touchstart", "touchmove", "keydown"])
    addEventListener(ev, wake, { passive: true });
  addEventListener("resize", () => { mode(); wake(); }, { passive: true });
  narrow.addEventListener("change", mode);
  mode();
})();
