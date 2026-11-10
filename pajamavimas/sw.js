// Medžiagų pajamavimas · service worker: Background Sync (Android) išsiunčia eilę net uždarius puslapį.
var DB_NAME = 'pajamavimas_ai';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('sync', function (e) {
  if (e.tag === 'pajamavimas-outbox') e.waitUntil(flush());
});

function openDb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('outbox', { keyPath: 'client_uuid' }); };
    r.onsuccess = function () { res(r.result); };
    r.onerror = function () { rej(r.error); };
  });
}
function tx(db, mode, fn) {
  return new Promise(function (res, rej) {
    var t = db.transaction('outbox', mode), out = fn(t.objectStore('outbox'));
    t.oncomplete = function () { res(out && out.result); };
    t.onerror = function () { rej(t.error); };
  });
}
function notify(msg) {
  return self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function (list) {
    list.forEach(function (c) { c.postMessage(msg); });
  });
}
function flush() {
  return openDb().then(function (db) {
    return tx(db, 'readonly', function (s) { return s.getAll(); }).then(function (items) {
      return Promise.all((items || []).map(function (it) {
        return fetch(it.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(it) })
          .then(function (r) { return r.json(); })
          .then(function (r) {
            if (!r.ok && r.kodas !== 410) throw new Error('server');
            return tx(db, 'readwrite', function (s) { return s.delete(it.client_uuid); }).then(function () {
              if (r.ok) return notify({ type: 'sent', client_uuid: it.client_uuid, nr: r.nr });
            });
          });
      }));
    });
  });
}
