// Joins src/ back into the single-file app at dist/index.html (the app must stay one file: the zip export copies its own page source).
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = fs.readdirSync(path.join(__dirname, 'src/js')).filter(f => f.endsWith('.js')).sort();
let out = src('head.html') + '<style>\n' + src('style.css') + '</style>\n' + src('body.html')
  + '<script>\n' + js.map(f => src('js/' + f)).join('') + '</script>\n' + src('tail.html');
// version line under the title: bump VERSION by hand on release
const VERSION = '1.0.0';
let commit = 'dev'; try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim(); } catch {}
const stamp = `v${VERSION} · ${commit} · ${new Date().toISOString().slice(0, 10)}`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), out.replace('{{BUILD}}', stamp));
console.log(`built dist/index.html (${js.length} js files, ${out.length} chars)`);
