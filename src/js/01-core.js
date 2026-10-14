(() => {
const $ = id => document.getElementById(id);
const cv = $('c'), mainCtx = cv.getContext('2d'), fxCv = $('fx'), fxCtx = fxCv.getContext('2d');
let ctx = mainCtx;   // drawing helpers use `ctx`; the frame points it at the trail layer or the FX layer
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI*2, GA = Math.PI*(3-Math.sqrt(5));
const rnd = i => { const x = Math.sin(i*12.9898 + 78.233)*43758.5453; return x - Math.floor(x); };
let W, H, DPR;

/* ================= Colors ================= */
const hexRGB = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const rgbStr = c => `${c[0]|0},${c[1]|0},${c[2]|0}`;
let ACC = '255,79,216';   // the interface colour as r,g,b (the canvases use it too)
function sample(stops, t){
  t = ((t % 1) + 1) % 1; const u = t < .5 ? t*2 : 2 - t*2;
  const x = u*(stops.length-1), i = Math.min(stops.length-2, Math.floor(x)), f = x - i;
  const a = stops[i], b = stops[i+1];
  return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f];
}

