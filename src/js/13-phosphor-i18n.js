/* ================= Languages (like numnuts: EN · 中文 · 日本語 · ES · FR · РУ · DE) ================= */
// keyed by the English text; anything without a translation (instrument, brush and effect names) stays English
const LANGS = [['en','EN'],['zh','中文'],['ja','日本語'],['es','ES'],['fr','FR'],['ru','РУ'],['de','DE']];
const TR_KEYS = ['Undo','Clear','Clear All?','Fullscreen','Help','Settings','Color','Custom','Sound','Style','Colors','Stays','Forever','▾ Hide','Vol','Close','Shortcuts','♪ Sound','✦ Visuals','Drag',
  'Draw and play notes: the outside of the circle is low, the middle is high','Play the scale (hold to sustain)','Brush size','Symmetry','Clear the drawing (press twice; undo brings it back)',
  'Eraser · move strokes (press again or Esc to draw)','Hide / show the bottom menu','This list','Draw',
  'Drag inside the circle. Every ring is a note: the outside is low, the middle is high. Pick a sound, a style and how long your pattern stays below.','Skip','Next','Done'];
const TR = {
  zh: ['撤销','清除','全部清除？','全屏','帮助','设置','颜色','自定义','声音','样式','配色','停留','永久','▾ 隐藏','音量','关闭','快捷键','♪ 声音','✦ 视觉','拖动',
    '画画并演奏：圆的外圈是低音，中心是高音','演奏音阶（按住延音）','笔刷大小','对称','清除画面（按两次；撤销可恢复）','橡皮 · 移动笔画（再按一次或 Esc 回到画笔）','隐藏 / 显示底部菜单','本列表','画',
    '在圆里拖动。每一圈都是一个音：外圈低，中心高。在下面选择声音、样式和图案停留的时间。','跳过','下一步','完成'],
  ja: ['元に戻す','クリア','全部消す？','全画面','ヘルプ','設定','色','カスタム','音色','スタイル','配色','残る時間','ずっと','▾ 隠す','音量','閉じる','ショートカット','♪ 音色','✦ ビジュアル','ドラッグ',
    '描いて演奏：円の外側が低音、中心が高音','音階を弾く（押し続けると伸ばす）','ブラシの太さ','対称','絵を消す（2回押す。元に戻せます）','消しゴム · 線を動かす（もう一度か Esc で描画）','下のメニューを隠す / 出す','この一覧','描く',
    '円の中をドラッグ。輪ひとつが音ひとつ：外側が低く、中心が高い。下で音色、スタイル、模様が残る時間を選べます。','スキップ','次へ','完了'],
  es: ['deshacer','borrar','¿borrar todo?','pantalla completa','ayuda','ajustes','color','propio','sonido','estilo','colores','dura','siempre','▾ ocultar','vol','cerrar','atajos','♪ sonido','✦ visuales','arrastrar',
    'Dibuja y toca notas: el borde del círculo es grave, el centro agudo','Toca la escala (mantén para sostener)','Tamaño del pincel','Simetría','Borra el dibujo (pulsa dos veces; deshacer lo recupera)','Goma · mover trazos (pulsa otra vez o Esc para dibujar)','Ocultar / mostrar el menú inferior','Esta lista','dibuja',
    'Arrastra dentro del círculo. Cada anillo es una nota: fuera grave, en el centro agudo. Abajo eliges sonido, estilo y cuánto dura tu dibujo.','saltar','siguiente','listo'],
  fr: ['annuler','effacer','tout effacer ?','plein écran','aide','réglages','couleur','perso','son','style','couleurs','reste','toujours','▾ masquer','vol','fermer','raccourcis','♪ son','✦ visuels','glisser',
    'Dessinez et jouez : le bord du cercle est grave, le centre aigu','Jouer la gamme (maintenir pour tenir)','Taille du pinceau','Symétrie','Effacer le dessin (deux fois ; annuler le ramène)','Gomme · déplacer les traits (encore ou Échap pour dessiner)','Masquer / afficher le menu du bas','Cette liste','dessiner',
    'Glissez dans le cercle. Chaque anneau est une note : grave au bord, aigu au centre. En bas, choisissez le son, le style et la durée du motif.','passer','suivant','fini'],
  ru: ['отменить','очистить','очистить всё?','полный экран','помощь','настройки','цвет','свой','звук','стиль','цвета','держится','всегда','▾ скрыть','громк.','закрыть','клавиши','♪ звук','✦ вид','тянуть',
    'Рисуйте и играйте: край круга — низкие ноты, центр — высокие','Играть гамму (держите, чтобы тянуть)','Размер кисти','Симметрия','Стереть рисунок (дважды; отмена вернёт)','Ластик · двигать штрихи (ещё раз или Esc — рисовать)','Скрыть / показать нижнее меню','Этот список','рисуйте',
    'Ведите внутри круга. Каждое кольцо — нота: снаружи низко, в центре высоко. Внизу выберите звук, стиль и сколько держится узор.','пропустить','дальше','готово'],
  de: ['rückgängig','löschen','alles löschen?','vollbild','hilfe','einstellungen','farbe','eigene','klang','stil','farben','bleibt','immer','▾ ausblenden','lautst.','schließen','tasten','♪ klang','✦ optik','ziehen',
    'Zeichnen und Noten spielen: außen tief, in der Mitte hoch','Tonleiter spielen (halten zum Klingenlassen)','Pinselgröße','Symmetrie','Zeichnung löschen (zweimal; rückgängig holt sie zurück)','Radierer · Striche verschieben (nochmal oder Esc zum Zeichnen)','Unteres Menü aus- / einblenden','Diese Liste','zeichnen',
    'Im Kreis ziehen. Jeder Ring ist eine Note: außen tief, in der Mitte hoch. Unten wählst du Klang, Stil und wie lange dein Muster bleibt.','überspringen','weiter','fertig']
};
var lang = 'en';   // var: setLbl can ask for a label before this file runs
try { const l = localStorage.getItem('mandawla-lang'); if (LANGS.some(([c]) => c === l)) lang = l; } catch {}
function i18n(en){ const i = TR_KEYS.indexOf(en); return (i >= 0 && TR[lang] && TR[lang][i]) || en; }
function applyLang(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = i18n(el.dataset.i18n); });
  document.querySelectorAll('.top button').forEach(b => { if (b.dataset.en) setLbl(b, b.dataset.en); });
  setLbl($('langBtn'), '◍ ' + LANGS.find(([c]) => c === lang)[1]);
  if (!$('tour').hidden) showTour(tourI);
}
$('langBtn').onclick = () => { const i = LANGS.findIndex(([c]) => c === lang); lang = LANGS[(i + 1) % LANGS.length][0]; try { localStorage.setItem('mandawla-lang', lang); } catch {} applyLang(); fitTop(); };

/* ================= Phosphor colour picker (numnuts' presets plus your own) ================= */
function setPal(open){ $('palette').hidden = !open; setP($('colorBtn'), open); $('colorBtn').setAttribute('aria-expanded', open);
  if (open){ const r = $('colorBtn').getBoundingClientRect(); Object.assign($('palette').style, { top: r.bottom + 6 + 'px', left: Math.max(8, Math.min(innerWidth - 228, r.right - 220)) + 'px' }); } }
function renderPhos(){
  const box = $('phos'); box.innerHTML = '';
  for (const k in THEMES){ if (k === 'custom') continue; const t = THEMES[k], b = document.createElement('button'); b.style.setProperty('--c', t.acc); b.setAttribute('aria-label', t.name); b.dataset.nm = t.name; setP(b, k === theme);
    b.onclick = () => { applyTheme(k); renderPhos(); }; box.append(b); }
  $('phosCustom').value = THEMES.custom ? THEMES.custom.acc : THEMES[theme].acc;
}
$('colorBtn').onclick = e => { e.stopPropagation(); setPal($('palette').hidden); renderPhos(); };
$('phosCustom').oninput = e => { THEMES.custom = phosphor('Custom', e.target.value); try { localStorage.setItem('mandawla-custom', e.target.value); } catch {} applyTheme('custom'); renderPhos(); };
addEventListener('pointerdown', e => { if (!$('palette').hidden && !e.target.closest('#palette,#colorBtn')) setPal(false); });
applyLang();

