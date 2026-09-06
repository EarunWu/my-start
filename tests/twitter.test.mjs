import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
const require = createRequire(import.meta.url);
const { latestPost, normalizePost, postMarkup, TwitterClient, toggleTranslation } = require('../twitter.js');
const post = (id = '100', overrides = {}) => ({ type: 'status', id, text: '新的一天', lang: 'zh', created_at: '2026-09-06T09:00:00Z', author: { screen_name: 'Example', name: 'Example' }, ...overrides });
const payload = (...results) => ({ code: 200, results });
const response = data => ({ ok: true, json: async () => data });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('selects newest authored non-reply, ignoring pinned order, reposts and malformed entries', () => {
  const data = payload(post('10', { created_at: '2020-01-01T00:00:00Z', pinned: true }),
    post('500', { author: { screen_name: 'SomeoneElse' } }), post('700', { replying_to: { status: '1' } }),
    post('800', { reposted_by: { screen_name: 'Example' } }), post('600', { created_at: 'bad' }), null,
    post('101'), post('102'));
  assert.equal(latestPost(data, 'EXAMPLE').id, '102');
  assert.equal(latestPost(payload(), 'Example'), null);
  assert.equal(latestPost(payload(post()), 'other'), null);
  assert.throws(() => latestPost({ code: 200 }, 'Example'));
  assert.throws(() => latestPost({ code: 429, results: [] }, 'Example'));
});

test('renders text safely and allows only trusted HTTPS media, with bounded quote depth', () => {
  const input = post('1', { text: '<img src=x onerror=alert(1)> https://example.com/?x="bad"',
    author: { screen_name: 'Example', name: '<script>bad</script>', avatar_url: 'javascript:alert(1)' },
    url: 'javascript:alert(1)', quote: post('2', { quote: post('3') }),
    media: { photos: [{ url: 'https://pbs.twimg.com.evil.test/x' }, { url: 'https://pbs.twimg.com/media/a.jpg', altText: '"><script>oops</script>' }], videos: [{ url: 'data:text/html,bad' }] } });
  const normalized = normalizePost(input), html = postMarkup(normalized);
  assert.equal(normalized.photos.length, 1);
  assert.equal(normalized.video, null);
  assert.equal(normalized.quote.quote, null);
  assert.match(html, /&lt;img/);
  assert.match(html, /https:\/\/x.com\/Example\/status\/1/);
  assert.doesNotMatch(html, /<script>|javascript:|evil\.test|<img src=x/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('same-account requests merge only while pending; later refresh always fetches anew', async () => {
  const calls = [], events = [[], []];
  const client = new TwitterClient({ fetcher: (url, options) => new Promise(resolve => calls.push({ url, options, resolve })) });
  const off1 = client.subscribe('Example', state => events[0].push(state));
  const off2 = client.subscribe('EXAMPLE', state => events[1].push(state));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.credentials, 'omit');
  calls[0].resolve(response(payload(post()))); await flush();
  assert.equal(events[0].at(-1).post.id, '100');
  assert.equal(events[1].at(-1).post.id, '100');
  assert.equal(client.pending.size, 0);
  client.load('example');
  assert.equal(calls.length, 2);
  off1(); assert.equal(calls[1].options.signal.aborted, false);
  off2(); assert.equal(calls[1].options.signal.aborted, true);
  assert.equal(client.views.size, 0);
});

test('HTTP errors, API error codes and malformed JSON recover on manual refresh', async () => {
  const responses = [{ ok: false, status: 429 }, response({ code: 404 }), response({ code: 200 }), { ok: true, json: async () => { throw new SyntaxError('bad json'); } }, response(payload(post()))];
  const states = [], client = new TwitterClient({ fetcher: async () => responses.shift() });
  const off = client.subscribe('Example', state => states.push(state));
  await flush(); assert.match(states.at(-1).error, /限制/);
  client.load('Example'); await flush(); assert.match(states.at(-1).error, /未找到/);
  client.load('Example'); await flush(); assert.match(states.at(-1).error, /格式/);
  client.load('Example'); await flush(); assert.ok(states.at(-1).error);
  client.load('Example'); await flush(); assert.equal(states.at(-1).post.id, '100'); off();
});

test('removing a view prevents stale results from replacing a new request for the same account', async () => {
  const calls = [], oldStates = [], newStates = [];
  const client = new TwitterClient({ fetcher: (url, options) => new Promise(resolve => calls.push({ options, resolve })) });
  const off = client.subscribe('Example', state => oldStates.push(state)); off();
  const offNew = client.subscribe('Example', state => newStates.push(state));
  calls[0].resolve(response(payload(post('1')))); await flush();
  assert.equal(client.pending.size, 1);
  assert.equal(newStates.at(-1).loading, true);
  calls[1].resolve(response(payload(post('2')))); await flush();
  assert.equal(newStates.at(-1).post.id, '2');
  assert.equal(oldStates.length, 1); offNew();
});

async function harness() {
  const calls = [], timers = new Map(); let timerId = 0;
  const ctx = createContext({ console, Intl, URL, AbortController,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    fetch(url, options) { return new Promise(resolve => calls.push({ url, options, resolve })); },
    document: { body: { dataset: { background: 'white' } } }, location: { protocol: 'file:' } });
  for (const file of ['twitter.js', 'widgets.js']) runInContext(await readFile(new URL('../' + file, import.meta.url), 'utf8'), ctx);
  const container = { isConnected: true, nodes: {}, set innerHTML(value) {
    this.markup = value; this.nodes = Object.fromEntries(['.twitter-status', '.twitter-scroll', '.twitter-refresh'].map(key => [key, { hidden: false, innerHTML: '' }]));
  }, querySelector(key) { return this.nodes[key]; }, replaceChildren() { this.nodes = {}; } };
  return { ctx, kit: ctx.WidgetKit, calls, timers, container, card: { querySelector: () => container } };
}

test('custom widget renders without an iframe, preserves content on movement/theme changes and supports file origins', async () => {
  const h = await harness(), w = { config: { username: 'Example' }, size: 'medium' };
  h.kit.registry.twitter.render(w, h.container);
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(response(payload(post()))); await flush();
  assert.equal(h.container.querySelector('.twitter-status').hidden, true);
  assert.match(h.container.querySelector('.twitter-scroll').innerHTML, /新的一天/);
  assert.doesNotMatch(h.container.markup, /iframe|widgets\.js/);
  h.ctx.document.body.dataset.background = 'black';
  h.kit.registry.twitter.render({ ...w, position: { x: 1, y: 500 } }, h.container);
  assert.equal(h.calls.length, 1);
  h.kit.retryTwitter(w); assert.equal(h.calls.length, 2);
  assert.equal(h.container.querySelector('.twitter-scroll').innerHTML, '');
  h.kit.registry.twitter.cleanup(h.card); assert.equal(h.timers.size, 0);
});

test('widget timeout and account changes ignore late replies and clean up timers', async () => {
  const h = await harness(), w = { config: { username: 'Example' }, size: 'medium' };
  h.kit.registry.twitter.render(w, h.container);
  h.kit.registry.twitter.render({ ...w, config: { username: 'Other' } }, h.container);
  assert.equal(h.calls[0].options.signal.aborted, true);
  h.calls[0].resolve(response(payload(post()))); await flush();
  assert.equal(h.container.querySelector('.twitter-status').hidden, false);
  [...h.timers.values()][0]();
  assert.match(h.container.querySelector('.twitter-status').innerHTML, /超时/);
  h.calls[1].resolve(response(payload(post('2', { author: { screen_name: 'Other' } })))); await flush();
  assert.equal(h.container.querySelector('.twitter-scroll').innerHTML, '');
  h.kit.registry.twitter.cleanup(h.card);
  assert.equal(h.timers.size, 0);
});

const translated = { text: '新的一天', source_lang: 'en', target_lang: 'zh-cn', provider: 'grok' };
test('translates only the selected post, shares the translation request and defaults to Chinese', async () => {
  const calls = [], states = [], client = new TwitterClient({ fetcher: (url, options) => new Promise(resolve => calls.push({ url, options, resolve })) });
  const off = client.subscribe('Example', state => states.push(state));
  calls[0].resolve(response(payload(post('100', { text: 'A new day', lang: 'en' }), post('10', { text: 'Old post', lang: 'en', created_at: '2020-01-01T00:00:00Z' })))); await flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://api.fxtwitter.com/2/status/100?lang=zh-cn');
  assert.equal(calls[1].options.cache, 'no-store');
  const otherStates = [], offOther = client.subscribe('EXAMPLE', state => otherStates.push(state));
  assert.equal(calls.length, 2);
  calls[1].resolve(response({ code: 200, status: post('100', { translation: translated }) })); await flush();
  assert.equal(states.at(-1).post.translation, '新的一天');
  assert.equal(otherStates.at(-1).post.text, 'A new day');
  const html = postMarkup(states.at(-1).post);
  assert.match(html, /data-twitter-text="translation" lang="zh-CN">新的一天/);
  assert.match(html, /data-twitter-text="original" hidden>A new day/);
  assert.match(html, /查看原文/);
  assert.equal(client.pending.size, 0); off(); offOther();
});

test('translation failure, missing translations and mismatched post IDs keep the original readable', async () => {
  for (const translationResponse of [{ ok: false, status: 429 }, response({ code: 200, status: post() }), response({ code: 200, status: post('999', { translation: translated }) })]) {
    const states = [], responses = [response(payload(post('100', { text: 'Original text', lang: 'en' }))), translationResponse];
    const client = new TwitterClient({ fetcher: async () => responses.shift() });
    const off = client.subscribe('Example', state => states.push(state)); await flush();
    assert.equal(states.at(-1).post.text, 'Original text');
    assert.equal(states.at(-1).post.translationUnavailable, true);
    const html = postMarkup(states.at(-1).post);
    assert.match(html, /翻译暂不可用，已显示原文/);
    assert.doesNotMatch(html, /twitter-translation-toggle/); off();
  }
});

test('translation timeout falls back to original and ignores a late translation', async () => {
  const h = await harness(), w = { config: { username: 'Example' }, size: 'medium' };
  h.kit.registry.twitter.render(w, h.container);
  h.calls[0].resolve(response(payload(post('100', { text: 'Original text', lang: 'en' })))); await flush();
  assert.equal(h.calls.length, 2);
  [...h.timers.values()][0]();
  assert.equal(h.calls[1].options.signal.aborted, true);
  const content = h.container.querySelector('.twitter-scroll');
  assert.match(content.innerHTML, /Original text/);
  assert.match(content.innerHTML, /翻译暂不可用/);
  const markup = content.innerHTML;
  h.calls[1].resolve(response({ code: 200, status: post('100', { translation: translated }) })); await flush();
  assert.equal(content.innerHTML, markup);
  h.kit.registry.twitter.cleanup(h.card);
});

test('translation is escaped, requires a Chinese target and original Chinese skips translation', async () => {
  const p = normalizePost(post('100', { translation: { ...translated, text: '<script>alert(1)</script>' } }));
  assert.match(postMarkup(p), /&lt;script&gt;/);
  assert.doesNotMatch(postMarkup(p), /<script>/);
  assert.equal(normalizePost(post('100', { translation: { ...translated, target_lang: 'es' } })).translation, '');
  assert.equal(normalizePost(post('100', { translation: { ...translated, text: {} } })).translation, '');
  let calls = 0;
  const states = [], client = new TwitterClient({ fetcher: async () => { calls++; return response(payload(post())); } });
  const off = client.subscribe('Example', state => states.push(state)); await flush();
  assert.equal(calls, 1);
  assert.doesNotMatch(postMarkup(states.at(-1).post), /查看译文|翻译暂不可用/); off();
});

test('switching languages only changes text visibility, independently for each component', () => {
  const card = () => {
    const button = { dataset: {}, textContent: '', setAttribute(name, value) { this[name] = value; } }, label = {};
    const texts = [{ dataset: { twitterText: 'translation' }, hidden: false }, { dataset: { twitterText: 'original' }, hidden: true }];
    return { button, label, texts, querySelector: selector => selector === '.twitter-translation-toggle' ? button : label, querySelectorAll: () => texts };
  };
  const a = card(), b = card();
  toggleTranslation(a);
  assert.equal(a.button.textContent, '查看译文');
  assert.equal(a.button['aria-label'], '查看译文');
  assert.deepEqual(a.texts.map(t => t.hidden), [true, false]);
  assert.deepEqual(b.texts.map(t => t.hidden), [false, true]);
  toggleTranslation(a);
  assert.equal(a.button.textContent, '查看原文');
  assert.deepEqual(a.texts.map(t => t.hidden), [false, true]);
});
