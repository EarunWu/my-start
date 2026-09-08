import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import kit from '../icons.js';

const hd = { width: 128, height: 128, vector: false };
const site = { url: 'https://litedrop.pununu.com/path', iconMode: 'auto' };
const memory = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key,value) => values.set(key,value) }; };

test('restored sharp sources paint synchronously without probing; low-quality legacy sources still upgrade', async () => {
  const storage = memory();
  const first = new kit.Resolver({ storage, probe: async () => hd });
  await first.resolve(site);
  let calls = 0;
  const restored = new kit.Resolver({ storage, probe: async () => { calls++; return hd; } });
  assert.deepEqual(restored.peek(site), { url: 'https://litedrop.pununu.com/favicon.svg', needsProbe: false });
  assert.equal(calls, 0);
  restored.remember('https://litedrop.pununu.com', 'https://cdn.example.org/old.png');
  assert.equal(restored.peek(site).needsProbe, true);
  assert.equal(restored.peek({ ...site, iconMode: 'custom', icon: 'https://cdn.example.org/new.png' }).url, 'https://cdn.example.org/new.png');
  assert.equal(restored.peek({ ...site, url: 'javascript:alert(1)' }), null);
});

test('broken cached images are evicted and a different source is discovered without retrying the broken URL', async () => {
  const storage = memory(), calls = [];
  const resolver = new kit.Resolver({ storage, probe: async url => { calls.push(url); return hd; } });
  const initial = await resolver.resolve(site);
  await resolver.forget(initial.url);
  calls.length = 0;
  assert.equal(resolver.peek(site), null);
  assert.equal(new kit.Resolver({ storage }).peek(site), null);
  assert.equal((await resolver.resolve(site)).url.endsWith('.ico'), true);
  assert.equal(calls.includes(initial.url), false);
});

test('an expired source remains available for immediate paint while requesting an upgrade', async () => {
  let now = 100;
  const storage = memory();
  const first = new kit.Resolver({ storage, now: () => now, probe: async () => hd });
  await first.resolve(site);
  now += 31 * 86400000;
  const restored = new kit.Resolver({ storage, now: () => now });
  assert.deepEqual(restored.peek(site), { url: 'https://litedrop.pununu.com/favicon.svg', needsProbe: true });
});

test('prefers SVG and remembers the successful URL across reloads', async () => {
  const storage = memory(), calls = [];
  const resolver = new kit.Resolver({ storage, probe: async url => { calls.push(url); return url.endsWith('.svg') ? hd : false; } });
  assert.equal((await resolver.resolve(site)).url, 'https://litedrop.pununu.com/favicon.svg');
  assert.deepEqual(calls, ['https://litedrop.pununu.com/favicon.svg']);
  const restored = new kit.Resolver({ storage, probe: async url => { calls.push(url); return hd; } });
  calls.length = 0;
  await restored.resolve(site);
  assert.deepEqual(calls, ['https://litedrop.pununu.com/favicon.svg']);
});

test('custom images take priority and survive failure without mutating configuration', async () => {
  const custom = { ...site, iconMode: 'custom', icon: 'https://cdn.example.org/my-logo.png' };
  const calls = [], resolver = new kit.Resolver({ probe: async url => { calls.push(url); return url.endsWith('.svg') ? hd : false; } });
  const before = JSON.stringify(custom);
  const result = await resolver.resolve(custom);
  assert.equal(calls[0], custom.icon);
  assert.equal(result.fallback, true);
  assert.equal(JSON.stringify(custom), before);
  calls.length = 0;
  resolver.probe = async url => { calls.push(url); return hd; };
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
  done[2].resolve(hd); await retry;
  done[0].resolve(hd); await first;
  assert.equal(resolver.entries['https://litedrop.pununu.com'].url.endsWith('.ico'), true);
});

test('invalid or unavailable storage does not break fallback; cached entries expire', async () => {
  let now = 1000000;
  const storage = memory();
  const resolver = new kit.Resolver({ storage, now: () => now, probe: async url => url.endsWith('.svg') ? hd : false });
  await resolver.resolve(site);
  now += 31 * 86400000;
  const restored = new kit.Resolver({ storage, now: () => now });
  assert.equal(restored.candidates(site)[0].endsWith('.svg'), true);
  const unavailable = new kit.Resolver({ storage: { getItem() { throw Error(); }, setItem() { throw Error(); } }, probe: async () => hd });
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
  images[0].onload(); assert.deepEqual(await success, { width: 32, height: 32, vector: true });
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


test('low-resolution conventional favicon is shown first and upgraded without changing the custom URL', async () => {
  const youtube = { url: 'https://www.youtube.com', iconMode: 'custom', icon: 'https://www.youtube.com/favicon.ico' };
  const calls = [], shown = [];
  const resolver = new kit.Resolver({ probe: async url => {
    calls.push(url);
    if (url.endsWith('.ico')) return { width: 16, height: 16 };
    return url.includes('google.com') ? hd : false;
  } });
  const before = JSON.stringify(youtube);
  const result = await resolver.resolve(youtube, { onCandidate: result => shown.push(result.width) });
  assert.deepEqual(shown, [16, 128]);
  assert.equal(result.upgraded, true); assert.equal(result.lowResolution, false);
  assert.match(result.url, /sz=128$/);
  assert.equal(JSON.stringify(youtube), before);
  assert.equal(calls.length, 3);
  calls.length = 0;
  await resolver.resolve(youtube);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /sz=128$/);
});

test('old low-quality cached sources do not prevent discovery of sharper icons', async () => {
  const storage = memory();
  const resolver = new kit.Resolver({ storage });
  resolver.remember('https://litedrop.pununu.com', 'https://cdn.example.org/old.png');
  const calls = [];
  const restored = new kit.Resolver({ storage, probe: async url => {
    calls.push(url); return url.endsWith('old.png') ? { width: 16, height: 16 } : { width: 24, height: 24, vector: true };
  } });
  const result = await restored.resolve(site);
  assert.equal(calls.length, 2);
  assert.equal(result.vector, true); assert.equal(result.lowResolution, false);
  assert.equal(restored.entries['https://litedrop.pununu.com'].url.endsWith('.svg'), true);
});

test('keeps the best usable raster when all high-resolution sources fail', async () => {
  const shown = [];
  const resolver = new kit.Resolver({ probe: async url => url.endsWith('.svg') ? false :
    url.endsWith('.ico') ? { width: 32, height: 32 } : { width: 16, height: 16 } });
  const result = await resolver.resolve(site, { onCandidate: value => shown.push(value.width) });
  assert.equal(result.width, 32); assert.equal(result.lowResolution, true);
  assert.deepEqual(shown, [32]);
});

test('intentional custom artwork is preserved even at low resolution; dense screens request larger images', async () => {
  const calls = [];
  const resolver = new kit.Resolver({ pixelRatio: 4, probe: async url => { calls.push(url); return { width: 16, height: 16 }; } });
  const result = await resolver.resolve({ ...site, iconMode: 'custom', icon: 'https://cdn.example.org/my-drawing.png' });
  assert.equal(calls.length, 1); assert.equal(result.lowResolution, true); assert.equal(result.fallback, false);
  assert.match(resolver.candidates(site).at(-1), /sz=256$/);
});

test('a subscriber joining after the initial candidate receives progress after its view can mount', async () => {
  let finish;
  const resolver = new kit.Resolver({ probe: async url => url.endsWith('.svg') ? { width: 16, height: 16 } :
    new Promise(resolve => { finish = resolve; }) });
  const first = resolver.resolve(site);
  await Promise.resolve(); await Promise.resolve();
  let mounted = false;
  const shown = [];
  const second = resolver.resolve(site, { onCandidate: result => shown.push({ mounted, width: result.width }) });
  mounted = true;
  finish(hd);
  await Promise.all([first, second]);
  assert.deepEqual(shown, [{ mounted: true, width: 16 }, { mounted: true, width: 128 }]);
});
