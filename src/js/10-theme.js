/* ================= Phosphor themes (remembered in this browser) ================= */
// numnuts-style single-colour phosphors: everything is one hue on black; the dark panels and dim text are mixed from it
// stroke shades from one colour: deep, the colour itself, a pale hot tint, then back to a mid tone
let UI_STOPS = [[255,79,216]];
function uiStops(hex){ const c = hexRGB(hex), mix = (k, w) => c.map(v => Math.round(Math.min(255, v*k + (255 - v*k)*w)));
  return [mix(.45, 0), mix(1, 0), mix(1, .45), mix(.75, 0)]; }
function phosphor(name, hex){ const [r,g,b] = hexRGB(hex), mix = k => '#' + [r,g,b].map(v => Math.round(v*k).toString(16).padStart(2,'0')).join('');
  return { name, ink: mix(.04), ink2: mix(.085), acc: hex, rose: hex, aqua: hex, text: hex, muted: mix(.62) }; }
const THEMES = { pink: phosphor('Pink','#ff4fd8'), amber: phosphor('Amber','#ffb000'), green: phosphor('Green','#33ff66'), cyan: phosphor('Cyan','#3ce6ff'), red: phosphor('Red','#ff3b30'), white: phosphor('White','#e8f0ff') };
try { const c = localStorage.getItem('mandawla-custom'); if (/^#[0-9a-f]{6}$/i.test(c || '')) THEMES.custom = phosphor('Custom', c); } catch {}
let theme = 'pink';
function applyTheme(k){
  const T = THEMES[k] || THEMES.pink, st = document.documentElement.style; theme = THEMES[k] ? k : 'pink';
  for (const [v, c] of [['--ink', T.ink], ['--ink2', T.ink2], ['--gold', T.acc], ['--rose', T.rose], ['--aqua', T.aqua], ['--text', T.text], ['--muted', T.muted]]) st.setProperty(v, c);
  ACC = hexRGB(T.acc).join(','); st.setProperty('--line', `rgba(${ACC},.3)`);
  UI_STOPS = uiStops(T.acc); renderBrushGrid(); drawBrushPreview();   // what you draw shares the colour
  $('colorBtn').innerHTML = '<span class="sw"></span>' + T.name.toLowerCase();
  try { localStorage.setItem('mandawla-theme', theme); } catch {}
}
try { theme = localStorage.getItem('mandawla-theme') || 'pink'; } catch {}
applyTheme(theme);

/* ================= Phosphor colour picker (numnuts' presets plus your own) ================= */
function setPal(open){ $('palette').hidden = !open; setP($('colorBtn'), open); $('colorBtn').setAttribute('aria-expanded', open);
  if (open){ const r = $('colorBtn').getBoundingClientRect(); const up = r.top > innerHeight/2;   // open away from the screen edge the button sits on
    Object.assign($('palette').style, { top: up ? 'auto' : r.bottom + 6 + 'px', bottom: up ? innerHeight - r.top + 6 + 'px' : 'auto', left: Math.max(8, Math.min(innerWidth - 228, r.right - 220)) + 'px' }); } }
function renderPhos(){
  const box = $('phos'); box.innerHTML = '';
  for (const k in THEMES){ if (k === 'custom') continue; const t = THEMES[k], b = document.createElement('button'); b.style.setProperty('--c', t.acc); b.setAttribute('aria-label', t.name); b.dataset.nm = t.name; setP(b, k === theme);
    b.onclick = () => { applyTheme(k); renderPhos(); }; box.append(b); }
  $('phosCustom').value = THEMES.custom ? THEMES.custom.acc : THEMES[theme].acc;
}
$('colorBtn').onclick = e => { e.stopPropagation(); setPal($('palette').hidden); renderPhos(); };
$('phosCustom').oninput = e => { THEMES.custom = phosphor('Custom', e.target.value); try { localStorage.setItem('mandawla-custom', e.target.value); } catch {} applyTheme('custom'); renderPhos(); };
addEventListener('pointerdown', e => { if (!$('palette').hidden && !e.target.closest('#palette,#colorBtn')) setPal(false); });

