// `expo export --platform web` (tek sayfa) çıktısını iPhone "Ana Ekrana Ekle" ve çevrimdışı kullanım için hazırlar.
// Kullanım: BASE=/diyabet-asistani node scripts/web-postbuild.mjs   (yerelde BASE boş bırakılabilir)
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const base = (process.env.BASE ?? '').replace(/\/$/, '');
const file = 'dist/index.html';
let html = readFileSync(file, 'utf8');

html = html.replace('<html lang="en">', '<html lang="tr">');
html = html.replace(/<meta name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />');

const register = `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${base}/sw.js',{scope:'${base}/'}).catch(function(){});});}`;
const head = `
    <meta name="theme-color" content="#0B7A86" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Diyabet" />
    <link rel="manifest" href="${base}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />
    <script>${register}</script>
  `;
if (!html.includes('rel="manifest"')) html = html.replace('</head>', head + '</head>');

writeFileSync(file, html);
// GitHub Pages bilinmeyen yollar için 404.html gösterir; uygulama kabuğunu vererek doğrudan bağlantılar da açılır
copyFileSync(file, 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
console.log('web-postbuild: tamam (base="' + base + '")');

// Servis çalışanını doldur: sürüm kimliği + önbelleğe alınacak tüm dosyalar
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative('dist', p).split(String.fromCharCode(92)).join('/'));
  }
})('dist');
const precache = files.filter((f) => !['sw.js', '404.html', '.nojekyll', 'metadata.json', 'favicon.ico'].includes(f));
let sw = readFileSync('dist/sw.js', 'utf8');
sw = sw.replace("/*__BUILD__*/ 'dev'", JSON.stringify(Date.now().toString(36))).replace('/*__PRECACHE__*/ []', JSON.stringify(precache));
writeFileSync('dist/sw.js', sw);
console.log('service worker: ' + precache.length + ' dosya önbelleğe alınacak');
