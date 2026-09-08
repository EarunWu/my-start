/* Only explicitly confirmed bookmark images are persisted. HTML, scripts and APIs
   always keep their normal network behavior. Opaque images stay opaque. */
'use strict';
const IMAGE_CACHE = 'my-start:icon-images:v1';
const META_CACHE = 'my-start:icon-image-times:v1';
const MAX_ICONS = 64;
const MAX_AGE = 30 * 86400000;
let writes = Promise.resolve();
const pending = new Map();
const revisions = new Map();

function write(task) {
  const result = writes.then(task);
  writes = result.catch(() => {});
  return result;
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

function validUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

async function remember(url, revision) {
  const cache = await caches.open(IMAGE_CACHE);
  const meta = await caches.open(META_CACHE);
  const previous = await cache.match(url, { ignoreVary: true });
  const stamp = await meta.match(url);
  if (previous && stamp && Date.now() - Number(await stamp.text()) < MAX_AGE) return;
  const response = await fetch(url, { mode: 'no-cors', credentials: 'omit',
    referrerPolicy: 'no-referrer', cache: previous ? 'reload' : 'force-cache',
    signal: AbortSignal.timeout(8000) });
  if (!response.ok && response.type !== 'opaque') return;
  await write(async () => {
    if ((revisions.get(url) || 0) !== revision) return;
    await cache.put(url, response);
    await meta.put(url, new Response(String(Date.now())));
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ICONS))) {
      await cache.delete(key, { ignoreVary: true });
      await meta.delete(key);
    }
  });
}

self.addEventListener('message', event => {
  if (!['remember-icons', 'forget-icons'].includes(event.data?.type)) return;
  const urls = [...new Set((Array.isArray(event.data.urls) ? event.data.urls : []).map(validUrl).filter(Boolean))].slice(0, MAX_ICONS);
  const tasks = urls.map(url => {
    if (event.data.type === 'forget-icons') {
      revisions.set(url, (revisions.get(url) || 0) + 1);
      pending.delete(url);
      return write(async () => {
          await (await caches.open(IMAGE_CACHE)).delete(url, { ignoreVary: true });
          await (await caches.open(META_CACHE)).delete(url);
      });
    }
    if (pending.has(url)) return pending.get(url);
    const task = remember(url, revisions.get(url) || 0);
    pending.set(url, task);
    task.finally(() => { if (pending.get(url) === task) pending.delete(url); }).catch(() => {});
    return task;
  });
  // Network requests may run concurrently; only cache writes are serialized.
  event.waitUntil(Promise.allSettled(tasks).then(() => event.ports[0]?.postMessage('done')));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.destination !== 'image' || event.request.mode !== 'no-cors') return;
  event.respondWith((async () => {
    try {
      const cached = await (await caches.open(IMAGE_CACHE)).match(event.request.url, { ignoreVary: true });
      if (cached) return cached;
    } catch { /* Fall back to the browser's normal HTTP cache/network. */ }
    // Explicit refresh also bypasses a stale entry in the browser's HTTP cache.
    return fetch(revisions.has(event.request.url) ? new Request(event.request, { cache: 'reload' }) : event.request);
  })());
});
