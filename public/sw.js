/* Diyabet Asistanı: çevrimdışı açılış için basit servis çalışanı.
 * - Sayfa gezintileri: önce ağ (yeni sürüm hemen gelsin), ağ yoksa kayıtlı uygulama kabuğu.
 * - Diğer dosyalar (hash'li JS, yazı tipi, görsel): önce önbellek.
 * Kullanıcı verileri burada değil, tarayıcının yerel depolamasındadır; bu dosya veriye dokunmaz. */
// Derleme sırasında scripts/web-postbuild.mjs bu iki satırı doldurur (sürüm kimliği ve önbelleğe alınacak dosyalar).
const BUILD = /*__BUILD__*/ 'dev';
const PRECACHE = /*__PRECACHE__*/ [];
const CACHE = 'diyabet-' + BUILD;
const SHELL = self.registration.scope + 'index.html';

self.addEventListener('install', (event) => {
  // Uygulamanın tüm dosyaları kurulumda indirilir: ilk açılıştan sonra internet olmadan da açılır
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all([SHELL, ...PRECACHE.map((f) => self.registration.scope + f)].map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
