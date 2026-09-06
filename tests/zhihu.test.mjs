import test from 'node:test';
import assert from 'node:assert/strict';
import kit from '../zhihu.js';
import widgets from '../widgets.js';
import { handleRequest } from '../server/worker.mjs';

const row = (id = '2079866742101241983', title = '测试问题') => ({ question: { id, title, url: 'javascript:alert(1)' }, reaction: { pv: 123456, answer_num: 12 } });
const payload = () => ({ data: [row()] });
const ok = data => Response.json(data);
const request = (path = '/api/zhihu/hot', options) => new Request(`https://example.com${path}`, options);

test('hot questions retain exact IDs and rank order, sanitize text/links and reject malformed payloads', () => {
  const items = kit.normalizeQuestions({ data: [row(), row(), row('2', '<script>x</script>'), row(2079866742101241983), null] });
  assert.deepEqual(items.map(i => i.id), ['2079866742101241983', '2']);
  assert.equal(items[0].url, 'https://www.zhihu.com/question/2079866742101241983');
  assert.equal(items[0].answers, 12);
  assert.equal(kit.formatCount(290000000), '2.9亿');
  assert.match(kit.listMarkup(items), /&lt;script&gt;/);
  assert.doesNotMatch(kit.listMarkup(items), /javascript:|<script>/);
  assert.equal(kit.normalizeQuestions({ data: Array.from({ length: 20 }, (_, i) => row(String(i))) }).length, 10);
  assert.deepEqual(kit.normalizeQuestions({ data: [] }), []);
  for (const data of [{}, { data: [null] }, { data: [row('x')] }]) assert.throws(() => kit.normalizeQuestions(data));
  assert.equal(kit.normalizeQuestions({ data: [{ ...row(), reaction: { pv: -1 } }] })[0].views, null);
});

test('Zhihu widgets round-trip, copy independently, and use collision-aware large sizes', () => {
  const input = { id: 'zhihu', type: 'zhihu', size: 'large', position: { x: .6, y: 300 }, config: { cookie: 'discard' } };
  const list = widgets.normalize([input, input]);
  assert.notEqual(list[0].id, list[1].id);
  assert.deepEqual(list[0].config, {});
  assert.deepEqual(widgets.normalize(JSON.parse(JSON.stringify(list))), list);
  const [width, height] = widgets.widgetSize(list[0]);
  assert.deepEqual([width, height], [460, 600]);
  const obstacle = { x: 16, y: 100, width: 660, height: 700 };
  const placed = widgets.placeRect({ x: 16, y: 104, width, height }, [obstacle], 700);
  assert.equal(widgets.overlaps(placed, obstacle), false);
  assert.ok(placed.x + width <= 684);
});

test('instances share in-flight and displayed data; manual refresh fetches again; last removal drops data', async () => {
  let calls = 0, resolve;
  const client = new kit.ZhihuClient({ fetcher: async () => { calls++; return new Promise(r => { resolve = r; }); }, now: () => 123 });
  const a = [], b = [];
  const offA = client.subscribe(s => a.push(s)), offB = client.subscribe(s => b.push(s));
  assert.equal(calls, 1);
  resolve(ok(payload())); await client.pending.promise;
  assert.equal(a.at(-1).updatedAt, 123); assert.equal(b.at(-1).items.length, 1);
  const c = [], offC = client.subscribe(s => c.push(s));
  assert.equal(calls, 1); assert.equal(c.at(-1).items.length, 1);
  const refresh = client.load(); assert.equal(calls, 2); resolve(ok({ data: [] })); await refresh;
  assert.deepEqual(a.at(-1).items, []);
  offA(); offB(); offC(); assert.equal(client.state, null);
});

test('removed mounts abort requests and late responses never overwrite a newer result', async () => {
  const calls = [];
  const client = new kit.ZhihuClient({ fetcher: (_, options) => new Promise(resolve => calls.push({ resolve, signal: options.signal })) });
  const off = client.subscribe(() => {}), old = client.pending.promise;
  off(); assert.equal(calls[0].signal.aborted, true);
  const states = [], offNew = client.subscribe(s => states.push(s)), fresh = client.pending.promise;
  calls[1].resolve(ok({ data: [row('22')] })); await fresh;
  calls[0].resolve(ok(payload())); await old;
  assert.equal(states.at(-1).items[0].id, '22'); offNew();
});

test('errors and timeouts are retryable without fake data', async () => {
  const states = [];
  const client = new kit.ZhihuClient({ fetcher: async () => new Response('', { status: 429 }) });
  const off = client.subscribe(s => states.push(s)); await client.pending.promise;
  assert.match(states.at(-1).error, /限制/); assert.equal(states.at(-1).items, undefined);
  client.fetcher = async () => ok(payload()); await client.load(); assert.equal(states.at(-1).items.length, 1); off();
  client.fetcher = async () => Response.json({ error: 'upstream_denied' }, { status: 502 });
  await client.load(); assert.match(client.state.error, /知乎暂未允许服务器/);
  const slow = new kit.ZhihuClient({ fetcher: () => new Promise(() => {}), timeoutMs: 5 });
  const offSlow = slow.subscribe(() => {});
  await new Promise(r => setTimeout(r, 20)); assert.match(slow.state.error, /超时/); assert.equal(slow.pending, null); offSlow();
});

test('proxy only fetches fixed public endpoint, never forwards cookies, and passes static files to ASSETS', async () => {
  let target, options;
  const response = await handleRequest(request(undefined, { headers: { Cookie: 'private', Authorization: 'private' } }), {}, async (url, opts) => { target = url; options = opts; return ok(payload()); });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), payload());
  assert.equal(target, 'https://www.zhihu.com/api/v4/creators/rank/hot?domain=0&period=hour');
  assert.deepEqual(options.headers, { Accept: 'application/json', 'User-Agent': 'MyStart/1.0 (+https://mystart.pununu.com)' }); assert.equal(options.redirect, 'manual');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const noFetch = () => { throw new Error('should not fetch'); };
  assert.equal((await handleRequest(request('/api/zhihu/hot?url=https://evil.com'), {}, noFetch)).status, 400);
  assert.equal((await handleRequest(request(undefined, { method: 'POST' }), {}, noFetch)).status, 405);
  assert.equal((await handleRequest(request('/api/other'), {}, noFetch)).status, 404);
  assert.equal(await (await handleRequest(request('/'), { ASSETS: { fetch: async () => new Response('homepage') } }, noFetch)).text(), 'homepage');
});

test('proxy handles upstream denial, HTML, invalid or oversized JSON, and timeout', async () => {
  const denied = await handleRequest(request(), {}, async () => Response.json({ error: { code: 40352 } }, { status: 403 }));
  assert.equal(denied.status, 502); assert.deepEqual(await denied.json(), { error: 'upstream_denied' });
  for (const [upstream, expected] of [[new Response('', { status: 429 }), 429], [new Response('', { status: 403 }), 502], [new Response('<html>'), 502], [ok({}), 502], [ok({ data: [], extra: 'x'.repeat(270000) }), 502]]) {
    assert.equal((await handleRequest(request(), {}, async () => upstream)).status, expected);
  }
  const response = await handleRequest(request(), {}, (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))), 5);
  assert.equal(response.status, 504);
});

test('production uses the authenticated HTTPS VPS relay, never visitor credentials', async () => {
  const env = { ZHIHU_PROXY_URL: 'https://mystart-api.pununu.com/api/zhihu/hot', ZHIHU_PROXY_KEY: 'test-server-key' };
  let target, options;
  const response = await handleRequest(request(undefined, { headers: { Authorization: 'Bearer visitor', Cookie: 'private' } }), env, async (url, opts) => { target = url; options = opts; return ok(payload()); });
  assert.equal(response.status, 200); assert.equal(target, env.ZHIHU_PROXY_URL);
  assert.equal(options.headers.Authorization, 'Bearer test-server-key');
  assert.equal(options.headers.Cookie, undefined); assert.equal(options.redirect, 'manual');
  assert.equal(response.headers.get('Authorization'), null);
});

test('relay misconfiguration fails closed and redirects never expose its key elsewhere', async () => {
  for (const env of [{ ZHIHU_PROXY_URL: 'https://mystart-api.pununu.com/api/zhihu/hot' }, { ZHIHU_PROXY_URL: 'http://mystart-api.pununu.com/api/zhihu/hot', ZHIHU_PROXY_KEY: 'test' }, { ZHIHU_PROXY_URL: 'https://evil.example', ZHIHU_PROXY_KEY: 'test' }]) {
    const response = await handleRequest(request(), env, () => assert.fail('must not send key'));
    assert.equal(response.status, 503);
  }
  let calls = 0;
  const response = await handleRequest(request(), { ZHIHU_PROXY_URL: 'https://mystart-api.pununu.com/api/zhihu/hot', ZHIHU_PROXY_KEY: 'test' }, async () => { calls++; return new Response(null, { status: 302, headers: { Location: 'https://evil.example' } }); });
  assert.equal(response.status, 502); assert.equal(calls, 1);
});
