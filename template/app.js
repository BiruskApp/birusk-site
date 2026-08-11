/* birusk.app — comportements. Aucune dépendance.
   Principe : rien ne tourne en continu. La boucle d'animation démarre à la
   demande et s'arrête d'elle-même dès qu'il n'y a plus rien à animer, pour ne
   pas vider la batterie des téléphones, qui font l'essentiel du trafic.       */

(() => {
  "use strict";

  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const rtl = root.dir === "rtl";
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ── découpe du hero ────────────────────────────────────────────────────────
  // En écriture arabe les lettres se lient selon leur position : les isoler
  // dans des balises casserait le mot. Le soranî s'anime donc d'un bloc.
  document.querySelectorAll("[data-split]").forEach((el) => {
    const text = el.textContent;
    if (rtl) { el.innerHTML = `<span class="ch" style="--i:0">${esc(text)}</span>`; return; }
    let i = 0;
    el.innerHTML = [...text]
      .map((c) => (c === " " ? " " : `<span class="ch" style="--i:${i++}">${esc(c)}</span>`))
      .join("");
  });

  // ── révélations ────────────────────────────────────────────────────────────
  const marks = [...document.querySelectorAll(".reveal, .ln")];
  if (reduced) {
    marks.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        obs.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    marks.forEach((el) => io.observe(el));
    requestAnimationFrame(() =>
      document.querySelectorAll(".hero .ln, .hero .reveal").forEach((el) => el.classList.add("in")));
  }

  // ── curseur, souris fine uniquement ────────────────────────────────────────
  const cursor = document.querySelector(".cursor");
  const cursorOn = fine && cursor && !reduced;
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;

  if (cursorOn) {
    root.classList.add("js-cursor");
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    const MODES = ["link", "view", "mail"];
    const setMode = (m) => MODES.forEach((k) => root.classList.toggle("cur-" + k, k === m));
    addEventListener("pointerover", (e) => {
      const hit = e.target.closest?.("[data-cursor]");
      setMode(hit ? hit.dataset.cursor : null);
    }, { passive: true });
    document.addEventListener("mouseleave", () => setMode(null));
  }

  // ── aimantation, écoute locale à l'élément ─────────────────────────────────
  // Pas de listener global : mesurer la position de chaque cible à chaque
  // mouvement de souris provoque un recalcul de mise en page permanent.
  if (fine && !reduced) {
    document.querySelectorAll("[data-magnet]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--gx", ((e.clientX - (r.left + r.width / 2)) * 0.07).toFixed(1) + "px");
        el.style.setProperty("--gy", ((e.clientY - (r.top + r.height / 2)) * 0.22).toFixed(1) + "px");
      }, { passive: true });
      el.addEventListener("pointerleave", () => {
        el.style.setProperty("--gx", "0px");
        el.style.setProperty("--gy", "0px");
      });
    });
  }

  // ── boucle à la demande ────────────────────────────────────────────────────
  const track = document.querySelector(".marquee-track");
  const bar = document.querySelector(".progress");
  const mark = document.querySelector(".watermark");

  let marqueeSeen = false;
  if (track) {
    new IntersectionObserver((es) => { marqueeSeen = es[0].isIntersecting; wake(); },
      { rootMargin: "120px" }).observe(track.parentElement);
  }

  let third = 0;
  const measure = () => { third = track ? track.scrollWidth / 3 : 0; };
  measure();
  addEventListener("resize", () => { measure(); wake(); }, { passive: true });

  let lastY = scrollY, boost = 0, offset = 0, lastTouch = 0, running = false;
  let prevBar = -1, prevWy = -1;
  const DRIFT = reduced ? 0 : 0.5;
  const sign = rtl ? 1 : -1;

  addEventListener("scroll", () => { lastTouch = performance.now(); wake(); }, { passive: true });

  function wake() { if (!running) { running = true; lastY = scrollY; requestAnimationFrame(frame); } }

  function frame(now) {
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;

    if (track && third && marqueeSeen) {
      boost += (dy * 1.1 - boost) * 0.14;
      offset += sign * (DRIFT + boost * 0.85);
      if (offset <= -third) offset += third;
      if (offset >= third) offset -= third;
      track.style.setProperty("--mvx", offset.toFixed(2) + "px");
    }

    if (bar) {
      const max = document.body.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(100, (y / max) * 100) : 0;
      if (Math.abs(p - prevBar) > 0.15) { bar.style.setProperty("--p", p.toFixed(2) + "%"); prevBar = p; }
    }

    if (mark && !reduced && y < innerHeight * 1.4) {
      const wy = y * 0.22;
      if (Math.abs(wy - prevWy) > 0.5) { mark.style.setProperty("--wy", wy.toFixed(1) + "px"); prevWy = wy; }
    }

    if (cursorOn) {
      rx += (mx - rx) * 0.17;
      ry += (my - ry) * 0.17;
      cursor.style.setProperty("--mx", mx + "px");
      cursor.style.setProperty("--my", my + "px");
      cursor.style.setProperty("--rx", rx.toFixed(2) + "px");
      cursor.style.setProperty("--ry", ry.toFixed(2) + "px");
    }

    // plus rien à animer : on rend la main jusqu'au prochain évènement
    const idle = !cursorOn && !marqueeSeen && now - lastTouch > 600;
    if (idle) { running = false; return; }
    requestAnimationFrame(frame);
  }

  // ── formulaire ─────────────────────────────────────────────────────────────
  // Le jeton n'est demandé qu'au premier contact avec le formulaire : un
  // visiteur qui ne fait que lire la page ne déclenche aucune requête.
  const form = document.querySelector(".form");
  if (form) {
    const say = form.querySelector(".form-say");
    const btn = form.querySelector(".send");
    const dict = form.dataset;
    let asked = false;

    async function token() {
      if (asked) return;
      asked = true;
      try {
        const r = await fetch(form.action.replace(/contact$/, "token"), { headers: { accept: "application/json" } });
        const { t, s } = await r.json();
        form.elements.t.value = t;
        form.elements.s.value = s;
      } catch { asked = false; }
    }
    form.addEventListener("focusin", token, { once: true });

    const tell = (msg, bad) => {
      say.textContent = msg;
      say.classList.add("form-say--on");
      say.classList.toggle("form-say--bad", Boolean(bad));
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      form.classList.add("tried");
      if (!form.checkValidity()) { tell(dict.invalid, true); form.reportValidity(); return; }

      await token();
      btn.disabled = true;
      tell(dict.sending);

      try {
        const r = await fetch(form.action, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.ok) {
          form.reset();
          form.classList.remove("tried");
          tell(dict.ok);
          return;                       // le bouton reste éteint : rien à renvoyer
        }
        tell(r.status === 422 ? dict.invalid : dict.failed, true);
      } catch {
        tell(dict.failed, true);
      }
      btn.disabled = false;
    });
  }

  // ── ancres ─────────────────────────────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.getElementById(a.getAttribute("href").slice(1));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });
})();
