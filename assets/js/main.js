/* A.S.D. Scafati Futsal Club — interactions */
(() => {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- fullscreen menu ---------- */
  const burger = $(".nav__burger");
  if (burger) {
    burger.addEventListener("click", () => {
      document.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", document.body.classList.contains("menu-open"));
    });
    $$(".menu a").forEach((a) =>
      a.addEventListener("click", () => document.body.classList.remove("menu-open"))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.body.classList.remove("menu-open");
    });
  }

  /* ---------- nav hide on scroll down ---------- */
  const nav = $(".nav");
  let lastY = window.scrollY;
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (nav && !document.body.classList.contains("menu-open")) {
          nav.classList.toggle("nav--hidden", y > lastY && y > 220);
        }
        lastY = y;
        ticking = false;
      });
    },
    { passive: true }
  );

  /* ---------- scroll reveals ---------- */
  const revealed = $$(".reveal");
  if (revealed.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealed.forEach((el) => io.observe(el));
  }

  /* ---------- player card tilt (fine pointers only) ---------- */
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  $$(".player").forEach((card) => {
    const frame = $(".player__frame", card);
    if (!frame) return;
    if (finePointer) {
      card.addEventListener("pointermove", (e) => {
        const r = frame.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        frame.style.setProperty("--ry", `${(px * 10).toFixed(2)}deg`);
        frame.style.setProperty("--rx", `${(-py * 10).toFixed(2)}deg`);
      });
      card.addEventListener("pointerleave", () => {
        frame.style.setProperty("--ry", "0deg");
        frame.style.setProperty("--rx", "0deg");
      });
    } else {
      // touch: tap toggles the exultance shot
      card.addEventListener("click", () => card.classList.toggle("is-flipped"));
    }
  });

  /* ---------- lightbox ---------- */
  const lb = $(".lightbox");
  if (lb) {
    const img = $("img", lb);
    const count = $(".lightbox__count", lb);
    const links = $$("[data-lightbox]");
    let idx = 0;

    const show = (i) => {
      idx = (i + links.length) % links.length;
      img.src = links[idx].getAttribute("href");
      img.alt = links[idx].querySelector("img")?.alt || "";
      count.textContent = `${idx + 1} / ${links.length}`;
    };
    const open = (i) => {
      show(i);
      lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };
    const close = () => {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
    };

    links.forEach((a, i) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        open(i);
      })
    );
    $(".lightbox__btn--close", lb).addEventListener("click", close);
    $(".lightbox__btn--prev", lb).addEventListener("click", () => show(idx - 1));
    $(".lightbox__btn--next", lb).addEventListener("click", () => show(idx + 1));
    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }

  /* ---------- footer year ---------- */
  const yearEl = $("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
