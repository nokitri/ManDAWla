/* ================= Catalogs ================= */
const BRUSHES = {
  line:{name:'Line', draw:'stroke'}, neon:{name:'Neon', draw:'neon'}, ribbon:{name:'Ribbon', draw:'fill'},
  calligraphy:{name:'Calligraphy', draw:'fill'}, comet:{name:'Comet', draw:'fill'}, dashed:{name:'Dashed', draw:'dash'},
  double:{name:'Double', draw:'alt'}, rope:{name:'Rope', draw:'alt'}, wave:{name:'Wave', draw:'alt'},
  zigzag:{name:'Zigzag', draw:'alt'}, lace:{name:'Lace', draw:'alt'}, lightning:{name:'Lightning', draw:'bolt'},
  dots:{name:'Dots', draw:'fill'}, beads:{name:'Beads', draw:'fill'}, rings:{name:'Rings', draw:'outline'},
  chain:{name:'Chain', draw:'chain'}, sparkle:{name:'Sparkle', draw:'fill'}, stars:{name:'Stars', draw:'fill'},
  petals:{name:'Petals', draw:'fill'}, leaves:{name:'Vine', draw:'vine'}, diamonds:{name:'Diamonds', draw:'fill'},
  triangles:{name:'Triangles', draw:'outline'}, hearts:{name:'Hearts', draw:'fill'}, spray:{name:'Spray', draw:'fill'},
  feather:{name:'Feather', draw:'hair'}, fur:{name:'Fur', draw:'hair'}, scales:{name:'Scales', draw:'outline'},
  ladder:{name:'Ladder', draw:'alt'}, stamp:{name:'Stamp', draw:'stamp'}
};
const MODES = {
  radial:'Radial', echo:'Golden Echo', spiral:'Spiral', rings:'Rings', bloom:'Bloom', flower:'Flower',
  mandala:'Mandala', lotus:'Lotus', fractal:'Fractal', tunnel:'Tunnel', vortex:'Vortex', galaxy:'Galaxy',
  sway:'Sway', ripple:'Ripple', breathe:'Breathe', starburst:'Starburst', wheel:'Wheel', orbit:'Orbit',
  twin:'Twin Suns', infinity:'Infinity', hextile:'Hex Tiles', quilt:'Mirror Quilt',
  double:'Double Spin', cascade:'Cascade', pinwheel:'Pinwheel', ellipse:'Ellipse', wobble:'Wobble', kaleido:'Kaleidoscope',
  heartbeat:'Heartbeat', clock:'Clockwork', snowflake:'Snowflake', corners:'Four Corners', helix:'Helix', bounce:'Bounce'
};
const INST_GROUPS = [
  ['Bells & Metal', { bell:'Bell', bowl:'Singing Bowl', gong:'Gong', crystal:'Crystal', celesta:'Celesta', musicbox:'Music Box', glass:'Glass' }],
  ['Plucked', { pluck:'Harp', guitar:'Guitar', kalimba:'Kalimba', koto:'Koto', sitar:'Sitar' }],
  ['Keys & Mallets', { piano:'Piano', harpsichord:'Harpsichord', vibes:'Vibraphone', marimba:'Marimba', epiano:'Electric Piano', organ:'Organ', steeldrum:'Steel Drum', handpan:'Handpan' }],
  ['Wind & Voice', { flute:'Flute', clarinet:'Clarinet', brass:'Brass', accordion:'Accordion', cello:'Cello', choir:'Airy Choir', strings:'Strings', pad:'Soft Pad' }],
  ['Bass', { bass:'Warm Bass', subbass:'Sub Bass', synthbass:'Synth Bass', pluckbass:'Pluck Bass', upright:'Upright Bass', reese:'Reese Bass', b808:'808' }],
  ['Synth', { lead:'Synth Lead', supersaw:'Supersaw', chip:'Chiptune', fmbell:'FM Bell', acid:'Acid Bass', wobble:'Wobble Bass' }],
  ['Drums', { kick:'Kick', snare:'Snare', clap:'Clap', snap:'Finger Snap', rimshot:'Rim Shot', tom:'Tom', conga:'Conga', bongo:'Bongo', cowbell:'Cowbell', hihat:'Hi-Hat', openhat:'Open Hi-Hat', shaker:'Shaker', tambourine:'Tambourine', triangle:'Triangle', ride:'Ride', crash:'Crash' }],
  ['Percussion', { tabla:'Tabla', woodblock:'Wood Block' }]
];
const INST_NAMES = Object.assign({ sampler:'Custom Sample' }, ...INST_GROUPS.map(g => g[1]));
// instruments that were removed: older projects switch to the closest one that is left
const RETIRED = { kick808:'kick', snare808:'snare', tom808:'tom', hat808:'hihat', kit:'kick', kit808:'kick' };
const SCALES = { penta:[0,2,4,7,9], minpenta:[0,3,5,7,10], hira:[0,2,3,7,8], insen:[0,1,5,7,10], dorian:[0,2,3,5,7,9,10],
  lydian:[0,2,4,6,7,9,11], mixo:[0,2,4,5,7,9,10], phryg:[0,1,3,5,7,8,10], whole:[0,2,4,6,8,10], minor:[0,2,3,5,7,8,10],
  harm:[0,2,3,5,7,8,11], raga:[0,1,4,5,7,8,11], arabic:[0,1,4,5,7,8,11], blues:[0,3,5,6,7,10] };

/* ================= State ================= */
const S = { sym:8, mirror:true, sing:true, draw:true, fade:-1, alpha:100, focus:false, zones:false, zone:'all', afxList:[{ type:'reverb', amt:40 }], vfxList:[], brush:'line', width:1,
  palette:'rainbow', c1:'#ff5fa2', c2:'#5fd4ff', c3:'#ffe27a', drift:true, spread:50, bright:100,
  bg:'custom', bgCustom:'#000000', stars:true, trail:60,
  kal:'radial', spin:30, viz:'spectrum', react:100, beatFx:true,
  inst:'bell', scale:'penta', key:0, tuning:432, oct:0, verb:45, echo:20, loop:false, bpm:84, quant:true,
  bars:4, grid:4, swing:0, countIn:true, arp:'off', holdMode:'sustain', glide:false, glideTime:140, timeline:true, rings:false, holdDraw:true, chord:'single', strum:0, metro:false, metroVol:60, rec:false, mix:{},
  tracks:[{ id:1, name:'', inst:'bell', v:80, m:false, s:false }], cur:1,
  loopB:0, duck:0, pitchCol:false, stamp:'✿', stampImg:null,   // per-track extras
 };
const S_DEFAULTS = JSON.parse(JSON.stringify(S));   // what a new track starts from
const LB = () => S.bars*4;
let presetName = null;
function updateMeta(){
  $('meta').textContent = [presetName || 'Untitled', (typeof curT === 'function' && curT() ? trackName(curT()) + ' · ' : '') + (typeof instLabel === 'function' && typeof curT === 'function' && curT() ? instLabel(curT()) : INST_NAMES[S.inst]), S.chord !== 'single' ? CHORD_NAMES[S.chord] : null, MODES[S.kal], S.loop ? S.bpm + ' BPM Loop' : null].filter(Boolean).join(' · ');
}
function bgHex(){ return S.bg === 'custom' ? S.bgCustom : BGS[S.bg].c; }
function isLight(){
  if (S.bg !== 'custom') return !!BGS[S.bg].light;
  const [r,g,b] = hexRGB(S.bgCustom); return (r*.299 + g*.587 + b*.114) > 150;
}
let LIGHT = false, BG = [0,0,0];
function applyBg(){
  LIGHT = isLight(); BG = hexRGB(bgHex());
  document.documentElement.style.setProperty('--bg', bgHex());
  drawStars();
}
/* ---- Background styles: still ones are painted once, moving ones every frame ---- */
const BG_ANIM = new Set(['twinkle','warp','dust','aurora','rings']);
let bgDots = null;
function bgStyle(){ return S.bgfx || (S.stars === false ? 'none' : 'stars'); }
function drawStars(){
  bgCtx.setTransform(1,0,0,1,0,0); bgCtx.clearRect(0,0,bgCv.width,bgCv.height);
  const st = bgStyle(); bgDots = null;
  if (st === 'none' || BG_ANIM.has(st)) return;
  const g = bgCtx, k = bgCv.width/W; g.setTransform(k,0,0,k,0,0);
  if (st === 'stars'){ if (!LIGHT) g.drawImage(stars, 0, 0, W, H); }
  else if (st === 'nebula'){   // soft clouds in the palette's colors
    let seed = 7; const rnd = () => (seed = (seed*9301 + 49297) % 233280)/233280;
    for (let i=0;i<9;i++){ const x = rnd()*W, y = rnd()*H, r = (.25 + rnd()*.45)*Math.max(W,H), c = rgbStr(paletteRGB(i/9 + .1));
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${LIGHT ? .14 : .13})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    if (!LIGHT) { g.globalAlpha = .6; g.drawImage(stars, 0, 0, W, H); g.globalAlpha = 1; }
  }
  else if (st === 'geometry'){ // a faint flower-of-life grid behind everything
    const r = Math.min(W, H)*.115, ink = LIGHT ? '40,36,48' : '235,225,205', cx = W/2, cy = CY(), h = r*Math.sqrt(3)/2;
    g.strokeStyle = `rgba(${ink},.07)`; g.lineWidth = 1;
    for (let row = -Math.ceil(H/h); row <= Math.ceil(H/h); row++) for (let col = -Math.ceil(W/r); col <= Math.ceil(W/r); col++){
      const x = cx + col*r + (row % 2 ? r/2 : 0), y = cy + row*h; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
  }
  g.setTransform(1,0,0,1,0,0);
}
function animBg(now, dt){
  const st = bgStyle(); if (!BG_ANIM.has(st)) return;
  const g = bgCtx, k = bgCv.width/W, ink = LIGHT ? '40,36,48' : '240,235,225', re = S.react/100;
  g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,bgCv.width,bgCv.height); g.setTransform(k,0,0,k,0,0);
  const N = st === 'dust' ? 90 : st === 'warp' ? 220 : 260;
  if (!bgDots || bgDots.style !== st){ bgDots = Array.from({ length: N }, () => ({ x: Math.random()*W, y: Math.random()*H, z: Math.random(), p: Math.random()*TAU, a: Math.random()*TAU, d: Math.random() })); bgDots.style = st; }
  if (st === 'twinkle') for (const s of bgDots){ const a = (.25 + .75*Math.abs(Math.sin(now*.0012*(.4 + s.z) + s.p)))*(.4 + high*.6); g.fillStyle = `rgba(${ink},${a*.85})`; const z = s.z > .92 ? 2 : 1.1; g.fillRect(s.x, s.y, z, z); }
  else if (st === 'dust'){ const c = rgbStr(paletteRGB(colorShift + .2));
    for (const s of bgDots){ s.x += Math.cos(s.a)*dt*.006*(1 + bass*re*2); s.y += Math.sin(s.a)*dt*.006 - dt*.004*s.z; s.a += (Math.random() - .5)*.02;
      if (s.x < -10) s.x = W + 10; if (s.x > W + 10) s.x = -10; if (s.y < -10) s.y = H + 10; if (s.y > H + 10) s.y = -10;
      const r = 1 + s.z*2.4; g.fillStyle = `rgba(${c},${.12 + s.z*.25})`; g.beginPath(); g.arc(s.x, s.y, r, 0, TAU); g.fill(); } }
  else if (st === 'warp'){ const cx = W/2, cy = CY(), sp = dt*(.05 + (bass*1.4 + beat)*.12*re);
    for (const s of bgDots){ s.d += sp*(.3 + s.d)*.04; if (s.d > 1.4){ s.d = .02; s.a = Math.random()*TAU; }
      const r0 = s.d*Math.max(W, H)*.6, r1 = r0*(1 - .06 - sp*.002), x0 = cx + Math.cos(s.a)*r0, y0 = cy + Math.sin(s.a)*r0;
      g.strokeStyle = `rgba(${ink},${Math.min(.8, s.d*.9)})`; g.lineWidth = .6 + s.d*1.4; g.beginPath(); g.moveTo(cx + Math.cos(s.a)*r1, cy + Math.sin(s.a)*r1); g.lineTo(x0, y0); g.stroke(); } }
  else if (st === 'aurora'){ for (let b=0;b<3;b++){ const c = rgbStr(paletteRGB(b/3 + colorShift)), y0 = H*(.2 + b*.12);
      const gr = g.createLinearGradient(0, y0 - 120, 0, y0 + 160); gr.addColorStop(0, `rgba(${c},0)`); gr.addColorStop(.5, `rgba(${c},${.1 + mid*.1})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, H); for (let x=0;x<=W;x+=24) g.lineTo(x, y0 + Math.sin(x*.004 + now*.0004*(b + 1) + b)*60 + Math.sin(x*.011 + now*.0007)*20); g.lineTo(W, H); g.closePath(); g.fill(); }
    if (!LIGHT){ g.globalAlpha = .5; g.drawImage(stars, 0, 0, W, H); g.globalAlpha = 1; } }
  else if (st === 'rings'){ const cx = W/2, cy = CY(), c = rgbStr(paletteRGB(colorShift + .4)), M = Math.hypot(W, H)*.6;
    for (let i=0;i<6;i++){ const u = ((now*.00008*(1 + bass*re) + i/6) % 1), r = u*M; g.strokeStyle = `rgba(${c},${(1 - u)*.12})`; g.lineWidth = 1 + (1 - u)*2; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); } }
  g.setTransform(1,0,0,1,0,0);
}
// render scale adapts to how fast frames are coming in (QUALITY drops on slow devices, recovers on fast ones)
let QUALITY = 1, FXDPR = 1;
function resize(){
  DPR = Math.min(devicePixelRatio||1, 1.5) * QUALITY; W = innerWidth; H = innerHeight;
  FXDPR = Math.min(devicePixelRatio||1, 2);
  for (const c of [cv, bgCv]){ c.width = Math.round(W*DPR); c.height = Math.round(H*DPR); }
  if (typeof TRAIL_LAYERS !== 'undefined') for (let i = 1; i < TRAIL_LAYERS.length; i++){ const L = TRAIL_LAYERS[i]; L.cv.width = cv.width; L.cv.height = cv.height; L.ctx.setTransform(DPR,0,0,DPR,0,0); }
  fxCv.width = Math.round(W*FXDPR); fxCv.height = Math.round(H*FXDPR);
  mainCtx.setTransform(DPR,0,0,DPR,0,0); fxCtx.setTransform(FXDPR,0,0,FXDPR,0,0);
  if (!stars || stars.width !== W || stars.height !== H){
  stars = document.createElement('canvas'); stars.width = W; stars.height = H;
  const s = stars.getContext('2d');
  for (let i=0;i<Math.round(W*H/3200);i++){ s.fillStyle=`rgba(240,235,225,${Math.random()*.85})`; const z = Math.random()<.08?1.8:1; s.fillRect(Math.random()*W, Math.random()*H, z, z); }
  }
  if (typeof LIGHT !== 'undefined') drawStars();
}
addEventListener('resize', resize); resize(); applyBg();

