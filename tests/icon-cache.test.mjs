import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import kit from '../icons.js';

const site = { url: 'https://litedrop.pununu.com/path', iconMode: 'auto' };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value) }; };

test('falls back from missing ico to SVG, remembers the successful URL across reloads', async () => {
  const storage = memory(), calls = [];
  const resolver = new kit.Resolver({ storage, probe: async url => { calls.push(url); return url.endsWith('.svg'); } });
  assert.equal((await resolver.resolve(site)).url, 'https://litedrop.pununu.com/favicon.svg');
  assert.deepEqual(calls, ['https://litedrop.pununu.com/favicon.ico', 'https://litedrop.pununu.com/favicon.svg']);
  const restored = new kit.Resolver({ storage, probe: async url => { calls.push(url); return true; } });
  calls.length = 0;
  await restored.resolve(site);
  assert.deepEqual(calls, ['https://litedrop.pununu.com/favicon.svg']);
});

test('custom images take priority and survive failure without mutating configuration', async () => {
  const custom = { ...site, iconMode: 'custom', icon: 'https://cdn.example.org/my-logo.png' };
  const calls = [], resolver = new kit.Resolver({ probe: async url => { calls.push(url); return url.endsWith('.svg'); } });
  const before = JSON.stringify(custom);
  const result = await resolver.resolve(custom);
  assert.equal(calls[0], custom.icon);
  assert.equal(result.fallback, true);
  assert.equal(JSON.stringify(custom), before);
  calls.length = 0;
  resolver.probe = async url => { calls.push(url); return true; };
  assert.equal((await resolver.resolve(custom, { force: true })).url, custom.icon);
  assert.equal(resolver.entries['https://litedrop.pununu.com'].url.endsWith('.svg'), true);
});

test('failed candidates cool down, expire, and explicit retry bypasses the cooldown', async () => {
  let now = 100, calls = 0;
  const resolver = new kit.Resolver({ now: () => now, probe: async () => { calls++; return false; } });
  assert.equal(await resolver.resolve(site), null);
  assert.equal(calls, 3);
  await resolver.resolve(site); assert.equal(calls, 3);
  await resolver.resolve(site, { force: true }); assert.equal(calls, 6);
  now += 300001; await resolver.resolve(site); assert.equal(calls, 9);
});

test('same-origin concurrent lookups share requests; explicit newer lookup owns the cache', async () => {
  const done = [], resolver = new kit.Resolver({ probe: url => new Promise(resolve => done.push({ url, resolve })) });
  const first = resolver.resolve(site), duplicate = resolver.resolve({ ...site, url: site.url + '/other' });
  assert.equal(first, duplicate); assert.equal(done.length, 1);
  const retry = resolver.resolve(site, { force: true });
  done[1].resolve(false); await Promise.resolve(); await Promise.resolve();
  done[2].resolve(true); await retry;
  done[0].resolve(true); await first;
  assert.equal(resolver.entries['https://litedrop.pununu.com'].url.endsWith('.svg'), true);
});

test('invalid or unavailable storage does not break fallback; cached entries expire', async () => {
  let now = 1000000;
  const storage = memory();
  const resolver = new kit.Resolver({ storage, now: () => now, probe: async url => url.endsWith('.svg') });
  await resolver.resolve(site);
  now += 31 * 86400000;
  const restored = new kit.Resolver({ storage, now: () => now });
  assert.equal(restored.candidates(site)[0].endsWith('.ico'), true);
  const unavailable = new kit.Resolver({ storage: { getItem() { throw Error(); }, setItem() { throw Error(); } }, probe: async () => true });
  assert.ok(await unavailable.resolve(site));
  assert.equal(await unavailable.resolve({ url: 'javascript:alert(1)' }), null);
  assert.equal(kit.safeUrl('https://user:pass@example.com'), '');
  assert.equal(unavailable.candidates({ ...site, iconMode: 'custom', icon: 'javascript:alert(1)' }).some(url => url.startsWith('javascript:')), false);
});

test('image probe uses an image without CORS fetch, handles load errors, timeouts and late events', async () => {
  const images = [];
  class Image {
    constructor() { images.push(this); this.naturalWidth = this.naturalHeight = 32; }
    removeAttribute(name) { this.removed = name; }
  }
  const success = kit.probeImage('https://other.example/icon.svg', 50, Image);
  assert.equal(images[0].crossOrigin, undefined);
  assert.equal(images[0].referrerPolicy, 'no-referrer');
  images[0].onload(); assert.equal(await success, true);
  const error = kit.probeImage('https://other.example/bad.svg', 50, Image);
  images[1].onerror(); assert.equal(await error, false);
  const timeout = kit.probeImage('https://other.example/slow.svg', 5, Image);
  const lateLoad = images[2].onload;
  assert.equal(await timeout, false); lateLoad();
  assert.equal(images[2].onload, null); assert.equal(images[2].removed, 'src');
});

test('legacy Google icons migrate to auto; manual URLs and explicit modes survive config round-trip', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const ctx = createContext({ document: { addEventListener() {} }, URL, console });
  runInContext(source, ctx);
  ctx.config = { version: 4, groups: [{ id: 'g', name: 'Saved' }], sites: [
    { id: 'a', groupId: 'g', name: 'Auto', url: site.url, icon: 'https://www.google.com/s2/favicons?domain=litedrop.pununu.com&sz=64' },
    { id: 'b', groupId: 'g', name: 'Manual', url: site.url, icon: 'https://example.org/logo.svg' },
    { id: 'c', groupId: 'g', name: 'Explicit', url: site.url, icon: 'https://www.google.com/s2/favicons?domain=litedrop.pununu.com&sz=64', iconMode: 'custom' }
  ] };
  const result = JSON.parse(runInContext('JSON.stringify(normalizeData(config))', ctx));
  assert.deepEqual(result.sites.map(site => site.iconMode), ['auto', 'custom', 'custom']);
  assert.equal(result.sites[1].icon, ctx.config.sites[1].icon);
  ctx.config = result;
  assert.deepEqual(JSON.parse(runInContext('JSON.stringify(normalizeData(config).sites)', ctx)), result.sites);
});
