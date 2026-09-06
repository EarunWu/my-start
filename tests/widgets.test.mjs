import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
const require = createRequire(import.meta.url);
const kit = require('../widgets.js');
const clock = (extra = {}) => ({ id: 'clock-1', type: 'clock', config: {}, ...extra });
const city = { name: '香港', latitude: 22.28, longitude: 114.17, timezone: 'Asia/Hong_Kong' };
const weather = () => ({ current: { temperature_2m: 27, weather_code: 2, time: '2026-09-06T12:00' }, daily: { time: ['2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'], weather_code: [2, 1, 3, 61, 0], temperature_2m_max: [29, 29, 30, 31, 30], temperature_2m_min: [24, 24, 25, 25, 24] } });
const storage = () => { const data = new Map(); return { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) }; };

test('old configs have no widgets; duplicate instances get independent identities and configs', () => {
  assert.deepEqual(kit.normalize(undefined), []);
  const normalized = kit.normalize([clock(), clock(), { type: 'unknown' }, { type: 'toString' }, null]);
  assert.equal(normalized.length, 2);
  assert.notEqual(normalized[0].id, normalized[1].id);
  normalized[0].config.style = 'analog';
  assert.equal(normalized[1].config.style, 'digital');
});
test('malformed sizes, coordinates, timezones and cities are normalized safely', () => {
  const [c, w] = kit.normalize([clock({ position: { x: Infinity, y: -10 }, size: 'huge', config: { timezone: 'Invalid/Zone' } }), { type: 'weather', config: { city: { ...city, latitude: 100 } } }]);
  assert.deepEqual(c.position, { x: 0, y: 88 });
  assert.equal(c.size, 'medium');
  assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: c.config.timezone }));
  assert.equal(w.config.city, null);
  assert.equal(kit.normalize([clock({ size: 'constructor' })])[0].size, 'medium');
});
test('layout preserves free placement and finds the nearest point with a 16px gap', () => {
  const desired = { x: 110, y: 220, width: 200, height: 160 };
  assert.deepEqual(kit.placeRect(desired, [], 1200), desired);
  const obstacle = { x: 300, y: 200, width: 200, height: 200 };
  const placed = kit.placeRect(desired, [obstacle], 1200);
  assert.equal(placed.x, 84);
  assert.equal(placed.y, 220);
  assert.equal(kit.overlaps(placed, obstacle), false);
});
test('X usernames accept handles and profile URLs, reject non-profile and unsafe URLs', () => {
  for (const value of [' X ', '@X', 'https://x.com/X', 'https://twitter.com/X/?lang=zh', 'www.x.com/@X', 'https://mobile.twitter.com/X']) {
    assert.equal(kit.twitterUsername(value), 'X', value);
  }
  for (const value of ['', null, {}, '@@X', '名字', 'abcdefghijklmnop', 'https://evil.com/X', 'https://x.com.evil.com/X', 'https://x.com@evil.com/X', 'javascript:alert(1)', 'https://x.com/X/status/123', 'https://x.com/home', '<img src=x>']) {
    assert.equal(kit.twitterUsername(value), '', String(value));
  }
});
test('X instances survive JSON round-trip with independent IDs and only public configuration', () => {
  const entry = { id: 'x-1', type: 'twitter', size: 'large', position: { x: .6, y: 900 }, config: { username: 'https://x.com/X', auth_token: 'must-not-persist' } };
  const saved = kit.normalize([entry, entry]);
  assert.deepEqual(saved[0].config, { username: 'X' });
  assert.notEqual(saved[0].id, saved[1].id);
  assert.deepEqual(kit.normalize(JSON.parse(JSON.stringify(saved))), saved);
  saved[0].config.username = 'other';
  assert.equal(saved[1].config.username, 'X');
});
async function twitterHarness() {
  const calls = [], timers = new Map(); let timerId = 0;
  const ctx = createContext({ console, Intl, URL, setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    document: { body: { dataset: { background: 'white' } } },
    twttr: { widgets: { createTimeline(source, host, options) { return new Promise((resolve, reject) => calls.push({ source, host, options, resolve, reject })); } } },
  });
  runInContext(await readFile(new URL('../widgets.js', import.meta.url), 'utf8'), ctx);
  const container = { isConnected: true, nodes: {}, set innerHTML(value) {
    this.markup = value; this.nodes = Object.fromEntries(['.twitter-status', '.twitter-embed'].map(key => [key, { hidden: false, remove() { this.removed = true; } }]));
  }, querySelector(key) { return this.nodes[key]; }, replaceChildren() { this.nodes = {}; } };
  return { kit: ctx.WidgetKit, ctx, calls, timers, container, card: { querySelector: () => container }, flush: async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); } };
}
test('X renderer sends one-item options, preserves mounted content, and follows theme changes', async () => {
  const h = await twitterHarness();
  const [w] = h.kit.normalize([{ type: 'twitter', config: { username: '@X' } }]);
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].source.screenName, 'X');
  assert.equal(h.calls[0].options.tweetLimit, 1);
  assert.equal(h.calls[0].options.dnt, true);
  const frame = {}; h.calls[0].resolve(frame); await h.flush();
  assert.equal(h.container.querySelector('.twitter-status').hidden, true);
  assert.equal(h.timers.size, 0);
  h.kit.registry.twitter.render({ ...w, position: { x: 1, y: 500 } }, h.container); await h.flush();
  assert.equal(h.calls.length, 1);
  h.ctx.document.body.dataset.background = 'black';
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  assert.equal(h.calls[1].options.theme, 'dark');
  h.kit.registry.twitter.cleanup(h.card);
  assert.equal(h.timers.size, 0);
});
test('file pages explain HTTP startup without attempting an unsupported X embed', async () => {
  const h = await twitterHarness(); h.ctx.location = { protocol: 'file:' };
  const [w] = h.kit.normalize([{ type: 'twitter', config: { username: 'X' } }]);
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
  assert.match(h.container.querySelector('.twitter-status').innerHTML, /start\.cmd/);
  assert.match(h.container.querySelector('.twitter-status').innerHTML, /先导出配置/);
  h.kit.registry.twitter.cleanup(h.card);
});
test('X account changes, timeouts and deletion ignore obsolete results and allow retry', async () => {
  const h = await twitterHarness();
  const [w] = h.kit.normalize([{ type: 'twitter', config: { username: 'X' } }]);
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  w.config.username = 'TwitterDev';
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  const obsolete = {}; h.calls[0].resolve(obsolete); await h.flush();
  assert.equal(obsolete.title, undefined);
  assert.equal(h.container.querySelector('.twitter-status').hidden, false);
  const host = h.calls[1].host;
  [...h.timers.values()][0]();
  assert.equal(host.removed, true);
  assert.match(h.container.querySelector('.twitter-status').innerHTML, /重新加载/);
  assert.doesNotMatch(h.container.querySelector('.twitter-status').innerHTML, /拦截|429|限流/);
  const late = {}; h.calls[1].resolve(late); await h.flush();
  assert.equal(late.title, undefined);
  h.kit.registry.twitter.cleanup(h.card);
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  assert.equal(h.calls.length, 3);
  h.kit.registry.twitter.cleanup(h.card);
  const removed = {}; h.calls[2].resolve(removed); await h.flush();
  assert.equal(removed.title, undefined);
  assert.deepEqual(h.container.nodes, {});
  assert.equal(h.timers.size, 0);
});
test('manual X retries share a case-insensitive cooldown and preserve the current mount', async () => {
  const h = await twitterHarness();
  const [w] = h.kit.normalize([{ type: 'twitter', config: { username: 'TwitterDev' } }]);
  h.kit.registry.twitter.render(w, h.container); await h.flush();
  const status = h.container.querySelector('.twitter-status');
  const sameAccount = { ...w, config: { username: 'twitterdev' } };
  assert.ok(h.kit.retryTwitter(sameAccount, h.card) > 0);
  await h.flush(); assert.equal(h.calls.length, 1);
  assert.equal(h.container.querySelector('.twitter-status'), status);
  assert.equal(h.kit.retryTwitter(sameAccount, h.card, Date.now() + 61000), 0);
  await h.flush(); assert.equal(h.calls.length, 2);
  h.kit.registry.twitter.cleanup(h.card);
});
test('narrow desktop placement expands downward without collisions or horizontal overflow', () => {
  const obstacles = [{ x: 0, y: 96, width: 700, height: 650 }];
  for (let i = 0; i < 12; i++) {
    const [width, height] = kit.widgetSize({ type: ['clock', 'weather', 'twitter'][i % 3], size: ['small', 'medium', 'large'][Math.floor(i / 3) % 3] });
    const placed = kit.placeRect({ x: 0, y: 104, width, height }, obstacles, 700);
    assert.ok(placed.x >= 16 && placed.x + placed.width <= 684);
    assert.ok(obstacles.every(o => !kit.overlaps(placed, o)));
    obstacles.push(placed);
  }
  assert.ok(obstacles.at(-1).y > 800);
});
test('clock follows local midnight and spring/fall DST transitions', () => {
  assert.equal(kit.clockParts(new Date('2026-09-05T16:00:00Z'), 'Asia/Shanghai').hour, 0);
  assert.equal(kit.clockParts(new Date('2026-03-08T06:59:00Z'), 'America/New_York').hour, 1);
  assert.equal(kit.clockParts(new Date('2026-03-08T07:00:00Z'), 'America/New_York').hour, 3);
  assert.equal(kit.clockParts(new Date('2026-11-01T06:00:00Z'), 'America/New_York').hour, 1);
});
test('timezone picker exposes all zones and searches Chinese cities, IANA names and offsets', () => {
  const options = kit.timezoneOptions('Asia/Shanghai', new Date('2026-07-01T00:00:00Z'));
  assert.ok(options.length > 50);
  assert.equal(options[0].zone, 'Asia/Shanghai');
  assert.ok(kit.filterTimezones(options, '北京').some(o => o.zone === 'Asia/Shanghai'));
  assert.ok(kit.filterTimezones(options, '纽约').some(o => o.zone === 'America/New_York'));
  assert.ok(kit.filterTimezones(options, 'new york').some(o => o.zone === 'America/New_York'));
  assert.ok(kit.filterTimezones(options, 'europe/london').some(o => o.zone === 'Europe/London'));
  assert.ok(kit.filterTimezones(options, 'UTC+08:00').some(o => o.zone === 'Asia/Shanghai'));
  assert.deepEqual(kit.filterTimezones(options, '不存在的城市zzzz'), []);
  assert.equal(kit.filterTimezones(options, '').length, options.length);
});
test('weather requests deduplicate by coordinates, cache results, and refresh after expiry', async () => {
  let calls = 0, now = 10000000, resolve;
  const client = new kit.WeatherClient({ storage: storage(), now: () => now, fetcher: async () => { calls++; await new Promise(r => { resolve = r; }); return { ok: true, json: async () => weather() }; } });
  client.active.add(client.key(city));
  const first = client.load(city), second = client.load({ ...city, name: 'Hong Kong' });
  assert.equal(calls, 1); resolve(); await Promise.all([first, second]);
  await client.load(city); assert.equal(calls, 1);
  now += 16 * 60000;
  const third = client.load(city); assert.equal(calls, 2); resolve(); await third;
  assert.equal(client.entry(city).data.current.temperature_2m, 27);
});
test('weather failure keeps cached values and exposes error; malformed data is rejected', async () => {
  let fail = false;
  const client = new kit.WeatherClient({ storage: storage(), fetcher: async () => ({ ok: !fail, json: async () => weather() }) });
  client.active.add(client.key(city));
  await client.load(city); const saved = client.entry(city).updatedAt;
  fail = true; await client.load(city, true);
  assert.equal(client.entry(city).error, true);
  assert.equal(client.entry(city).updatedAt, saved);
  assert.equal(client.entry(city).data.current.temperature_2m, 27);
  assert.equal(kit.validWeather({ current: { temperature_2m: '27' } }), false);
});
test('removed city requests cannot publish an obsolete response', async () => {
  let resolve;
  const client = new kit.WeatherClient({ storage: storage(), fetcher: async () => { await new Promise(r => { resolve = r; }); return { ok: true, json: async () => weather() }; } });
  client.active.add(client.key(city));
  const pending = client.load(city); client.sync([]); resolve(); await pending;
  assert.equal(client.entry(city).data, undefined);
});
test('an aborted request cannot clear a replacement request loading state', async () => {
  const resolvers = [];
  const client = new kit.WeatherClient({ storage: storage(), fetcher: async () => { await new Promise(r => resolvers.push(r)); return { ok: true, json: async () => weather() }; } });
  client.sync([city]); const old = client.pending.get(client.key(city)).promise;
  client.sync([]); client.sync([city]); const replacement = client.pending.get(client.key(city)).promise;
  resolvers[0](); await old;
  assert.equal(client.entry(city).loading, true);
  assert.equal(client.entry(city).data, undefined);
  resolvers[1](); await replacement;
  assert.equal(client.entry(city).loading, false);
  assert.equal(client.entry(city).data.current.temperature_2m, 27);
});
test('version 3 navigation survives version 4 upgrade and widget settings round-trip', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const ctx = createContext({ document: { addEventListener() {} }, WidgetKit: kit, console, Intl, URL });
  runInContext(source, ctx);
  ctx.config = { version: 3, groups: [{ id: 'mine', name: '自定义' }], sites: [{ id: 'site', groupId: 'mine', name: '自定义网站', url: 'https://example.com' }], widgets: [clock({ config: { timezone: 'Europe/London', style: 'analog', seconds: false } })], settings: {} };
  assert.equal(runInContext('shouldApplyNavigationPresetMigration(config)', ctx), false);
  const saved = JSON.parse(runInContext('JSON.stringify(normalizeData(config))', ctx));
  assert.equal(saved.version, 4); assert.equal(saved.groups[0].name, '自定义'); assert.equal(saved.sites[0].name, '自定义网站');
  assert.equal(saved.widgets[0].config.timezone, 'Europe/London');
  assert.equal(saved.widgets[0].config.style, 'analog');
  assert.equal(saved.widgets[0].config.seconds, false);
});
