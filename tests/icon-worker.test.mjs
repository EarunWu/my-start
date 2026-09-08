import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(new URL('../icon-cache-sw.js', import.meta.url), 'utf8');
const icon = 'https://cdn.example.org/icon.svg';
function harness() {
  const handlers = {}, stores = new Map(), calls = [];
  let network = async () => new Response('<svg/>');
  const caches = { async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name), key = value => typeof value === 'string' ? value : value.url;
    return {
      async match(value) { return entries.get(key(value))?.clone(); },
      async put(value, response) { entries.set(key(value), response.clone()); },
      async delete(value) { return entries.delete(key(value)); },
      async keys() { return [...entries.keys()].map(url => ({ url })); }
    };
  } };
  runInContext(source, createContext({ self: { addEventListener(type, handler) { handlers[type] = handler; } },
    caches, URL, Response, AbortSignal, console,
    Request: class { constructor(request, options) { Object.assign(this, request, options); } },
    fetch: async (...args) => { calls.push(args); return network(...args); } }));
  return { stores, calls, caches, network(fn) { network = fn; },
    message(type, urls) {
      let work;
      handlers.message({ data: { type, urls }, ports: [], waitUntil(value) { work = value; } });
      return work;
    },
    image(url = icon, extra = {}) {
      let result;
      handlers.fetch({ request: { url, destination: 'image', mode: 'no-cors', method: 'GET', ...extra },
        respondWith(value) { result = value; } });
      return result;
    }
  };
}

test('confirmed cross-origin opaque images persist and load offline without a network request', async () => {
  const h = harness();
  const opaque = { ok: false, type: 'opaque', clone() { return this; } };
  h.network(async () => opaque);
  await h.message('remember-icons', [icon]);
  assert.equal(h.calls[0][1].mode, 'no-cors');
  assert.equal(h.calls[0][1].credentials, 'omit');
  h.calls.length = 0;
  h.network(async () => { throw Error('offline'); });
  assert.equal((await h.image()).type, 'opaque');
  await h.message('remember-icons', [icon]);
  assert.equal(h.calls.length, 0);
  assert.equal(h.image(icon, { destination: 'script' }), undefined);
  assert.equal(h.image(icon, { destination: '' }), undefined);
  assert.equal(h.image(icon, { mode: 'cors' }), undefined);
});

test('expired cache displays immediately and survives a failed background refresh', async () => {
  const h = harness();
  await h.message('remember-icons', [icon]);
  await (await h.caches.open('my-start:icon-image-times:v1')).put(icon, new Response('0'));
  h.network(async () => { throw Error('offline'); });
  assert.equal(await (await h.image()).text(), '<svg/>');
  await h.message('remember-icons', [icon]);
  assert.equal(h.calls.at(-1)[1].cache, 'reload');
  assert.equal(await (await h.image()).text(), '<svg/>');
});

test('explicit refresh evicts stored bytes and prevents an older in-flight response repopulating the cache', async () => {
  const h = harness();
  await h.message('remember-icons', [icon]);
  await h.message('forget-icons', [icon]);
  let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  h.network(() => new Promise(resolve => { finish = resolve; started(); }));
  const old = h.message('remember-icons', [icon]);
  await ready;
  await h.message('forget-icons', [icon]);
  finish(new Response('obsolete'));
  await old;
  assert.equal(await (await h.caches.open('my-start:icon-images:v1')).match(icon), undefined);
});

test('cache is bounded, rejects unsafe URLs, and does not persist network errors', async () => {
  const h = harness();
  await h.message('remember-icons', ['data:image/png;base64,a', 'https://user:pass@example.org/icon']);
  assert.equal(h.calls.length, 0);
  await Promise.all(Array.from({ length: 70 }, (_, i) => h.message('remember-icons', [`https://cdn.example.org/${i}.png`])));
  const cache = await h.caches.open('my-start:icon-images:v1');
  assert.equal((await cache.keys()).length, 64);
  h.network(async () => new Response('missing', { status: 404 }));
  await h.message('remember-icons', [icon]);
  assert.equal(await cache.match(icon), undefined);
});

test('manual refresh bypasses HTTP cache too, and unrelated images retain normal behavior', async () => {
  const h = harness();
  await h.message('remember-icons', [icon]);
  await h.message('forget-icons', [icon]);
  await h.image();
  assert.equal(h.calls.at(-1)[0].cache, 'reload');
  await h.image('https://other.example.org/avatar.png');
  assert.equal(h.calls.at(-1)[0].cache, undefined);
  assert.equal(await (await h.caches.open('my-start:icon-images:v1')).match('https://other.example.org/avatar.png'), undefined);
});
