// Joins src/ back into the single-file app at dist/index.html (the app must stay one file: the zip export copies its own page source).
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = fs.readdirSync(path.join(__dirname, 'src/js')).filter(f => f.endsWith('.js')).sort();
const out = src('head.html') + '<style>\n' + src('style.css') + '</style>\n' + src('body.html')
  + '<script>\n' + js.map(f => src('js/' + f)).join('') + '</script>\n' + src('tail.html');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/index.html'), out);
console.log(`built dist/index.html (${js.length} js files, ${out.length} chars)`);
