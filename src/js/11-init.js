/* ================= Startup ================= */
renderBrushGrid(); syncUI(); fitTop();
requestAnimationFrame(frame);
[1,0,4].forEach((s,k) => setTimeout(() => demoStroke(true, s), 250 + k*500));
})();
