/* ================= Startup ================= */
renderBrushGrid(); syncUI(); applyLang(); fitTop();
requestAnimationFrame(frame);
[1,0,4].forEach((s,k) => setTimeout(() => demoStroke(true, s), 250 + k*500));
{ let seen = true; try { seen = !!localStorage.getItem('mandawla-tour'); } catch {} if (!seen) setTimeout(() => showTour(0), 1400); }
})();
