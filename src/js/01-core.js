(() => {
const PAGE_SRC = '<!doctype html>\n' + document.documentElement.outerHTML.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/gi, '');
const $ = id => document.getElementById(id);
const cv = $('c'), mainCtx = cv.getContext('2d'), fxCv = $('fx'), fxCtx = fxCv.getContext('2d'), bgCv = $('bgc'), bgCtx = bgCv.getContext('2d');
let ctx = mainCtx;   // drawing helpers use `ctx`; the frame points it at the trail layer or the FX layer
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI*2, GA = Math.PI*(3-Math.sqrt(5));
const rnd = i => { const x = Math.sin(i*12.9898 + 78.233)*43758.5453; return x - Math.floor(x); };
let W, H, DPR, stars;

/* ================= Colors ================= */
const hexRGB = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
function hsl2rgb(h,s,l){ h=((h%360)+360)%360; s/=100; l/=100; const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))); return [f(0)*255,f(8)*255,f(4)*255]; }
const PALETTES = {
  rainbow: { name:'Rainbow' },
  aurora:  { name:'Aurora',  stops:['#3cf2b0','#2bb6d9','#6d5df0','#c46cf5'] },
  ember:   { name:'Ember',   stops:['#ffe08a','#ff9a3d','#ff3d5a','#c0156a'] },
  ocean:   { name:'Ocean',   stops:['#c8f6ff','#4fd1e8','#2a7bd6','#4b44c8'] },
  gold:    { name:'Gold', stops:['#fff3c8','#f2c96b','#d9a14a','#c27b3c'] },
  sakura:  { name:'Sakura',  stops:['#fff0f6','#ffb3d1','#f27bb0','#c9518f'] },
  cyber:   { name:'Cyber',   stops:['#00f0ff','#5b8cff','#b04bff','#ff2bd6'] },
  forest:  { name:'Forest',  stops:['#e2ff8f','#7fe08a','#2fb38c','#2a8a8a'] },
  sunset:  { name:'Sunset',  stops:['#ffd36e','#ff7b6b','#d14d9c','#6b4bd1'] },
  ice:     { name:'Ice',     stops:['#ffffff','#d6f0ff','#9fd4ff','#8a9dff'] },
  mono:    { name:'Moonlight', stops:['#ffffff','#e9e4da','#c9c2b6'] },
  custom:  { name:'Custom' }
};
const BGS = {
  black:   { name:'Black', c:'#000000' },
  space:   { name:'Deep Space', c:'#07060d' },
  midnight:{ name:'Midnight', c:'#040a1c' },
  plum:    { name:'Plum', c:'#16081a' },
  teal:    { name:'Abyss', c:'#021417' },
  wine:    { name:'Wine', c:'#180409' },
  forest:  { name:'Moss', c:'#05110a' },
  paper:   { name:'Paper', c:'#f2eee4', light:true },
  sky:     { name:'Daylight', c:'#e8f0f7', light:true },
  custom:  { name:'Custom' }
};
const rgbStr = c => `${c[0]|0},${c[1]|0},${c[2]|0}`;
let ACC = '232,199,126';   // the interface accent as r,g,b (the canvases use it too)
function sample(stops, t){
  t = ((t % 1) + 1) % 1; const u = t < .5 ? t*2 : 2 - t*2;
  const x = u*(stops.length-1), i = Math.min(stops.length-2, Math.floor(x)), f = x - i;
  const a = stops[i], b = stops[i+1];
  return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f];
}
const STOPS = {}; for (const k in PALETTES) if (PALETTES[k].stops) STOPS[k] = PALETTES[k].stops.map(hexRGB);

