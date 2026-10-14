/* ================= Catalogs ================= */
const BRUSHES = {
  line:{name:'Line', draw:'stroke'},
  comet:{name:'Comet', draw:'fill'}, dashed:{name:'Dashed', draw:'dash'},
  double:{name:'Double', draw:'alt'}, wave:{name:'Wave', draw:'alt'},
  lace:{name:'Lace', draw:'alt'}, lightning:{name:'Lightning', draw:'bolt'},
  dots:{name:'Dots', draw:'fill'}, rings:{name:'Rings', draw:'outline'},
  stars:{name:'Stars', draw:'fill'},
  petals:{name:'Petals', draw:'fill'}, leaves:{name:'Vine', draw:'vine'}, diamonds:{name:'Diamonds', draw:'fill'},
  triangles:{name:'Triangles', draw:'outline'}, hearts:{name:'Hearts', draw:'fill'}, spray:{name:'Spray', draw:'fill'},
  feather:{name:'Feather', draw:'hair'}, scales:{name:'Scales', draw:'outline'},
  stamp:{name:'Stamp', draw:'stamp'}
};
const MODES = {
  radial:'Radial', echo:'Golden Echo', spiral:'Spiral', rings:'Rings', bloom:'Bloom', flower:'Flower', mandala:'Mandala', lotus:'Lotus',
  fractal:'Fractal', tunnel:'Tunnel', galaxy:'Galaxy', ripple:'Ripple', starburst:'Starburst', orbit:'Orbit', twin:'Twin Suns',
  infinity:'Infinity', hextile:'Hex Tiles', quilt:'Mirror Quilt', ellipse:'Ellipse', snowflake:'Snowflake'
};
const SCALES = { penta:[0,2,4,7,9], minpenta:[0,3,5,7,10], major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], };

/* ================= State ================= */
const S = { stay:2, sym:8, mirror:true, brush:'line', width:1, trail:60, kal:'radial', react:30,
  vol:80, scale:'penta', key:0, tuning:432, chord:'single', stamp:'✿', stampImg:null };
// render scale adapts to how fast frames are coming in (QUALITY drops on slow devices, recovers on fast ones)
let QUALITY = 1, FXDPR = 1;
function resize(){
  DPR = Math.min(devicePixelRatio||1, 1.5) * QUALITY; W = innerWidth; H = innerHeight;
  FXDPR = Math.min(devicePixelRatio||1, 2);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
  fxCv.width = Math.round(W*FXDPR); fxCv.height = Math.round(H*FXDPR);
  mainCtx.setTransform(DPR,0,0,DPR,0,0); fxCtx.setTransform(FXDPR,0,0,FXDPR,0,0);
}
addEventListener('resize', resize); resize();

