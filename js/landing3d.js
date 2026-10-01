import { mountScale } from "./scene3d.js";

// Hero: angka simulasi (bukan data sensor). Halaman ini publik, tanpa login.
const heroWeightEl = document.getElementById("hero-weight");
const scale = mountScale(document.getElementById("hero-stage"), { initialWeight: 62.4 });

let demo = 62.4;
scale.setWeight(demo);
setInterval(() => {
  demo = Math.min(64.5, Math.max(60.5, demo + (Math.random() - 0.5) * 0.6));
  scale.setWeight(demo);
  if (heroWeightEl) heroWeightEl.textContent = demo.toFixed(2);
}, 2200);

// Stepper 01–04: langkah aktif maju otomatis (garis progres terisi), berhenti saat di-hover/fokus.
const tiles = [...document.querySelectorAll("#stepper .step-tile")];
const STEP_MS = 3200;
let current = 0;
let timer = null;

function activate(i) {
  tiles.forEach((t, idx) => {
    t.classList.toggle("is-active", idx === i);
    t.classList.toggle("is-done", idx < i);
  });
  current = i;
}
function start() {
  stop();
  timer = setInterval(() => activate((current + 1) % tiles.length), STEP_MS);
}
function stop() {
  clearInterval(timer);
}
if (tiles.length) {
  document.documentElement.style.setProperty("--step-ms", `${STEP_MS}ms`);
  activate(0);
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) start();
  tiles.forEach((t, i) => {
    t.addEventListener("pointerenter", () => {
      stop();
      activate(i);
      t.classList.add("is-paused");
    });
    t.addEventListener("pointerleave", () => {
      t.classList.remove("is-paused");
      start();
    });
    t.addEventListener("focusin", () => {
      stop();
      activate(i);
    });
  });
}

// Menu navigasi (mobile)
const toggle = document.getElementById("nav-toggle");
const links = document.getElementById("nav-links");
if (toggle && links) {
  const close = () => {
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  };
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

// Navbar jadi solid setelah scroll
const navbar = document.querySelector(".navbar");
const onScroll = () => navbar?.classList.toggle("is-scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();
