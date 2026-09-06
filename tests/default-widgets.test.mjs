import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import kit from '../widgets.js';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
function context(saved) {
  const values = new Map(saved ? [['my-start-config-v1', JSON.stringify(saved)]] : []);
  const ctx = createContext({ document: { addEventListener() {} }, WidgetKit: kit, URL, console,
    window: { localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) } } });
  runInContext(source, ctx);
  // Background blobs are a separate storage boundary from the configuration under test.
  runInContext('backgroundAssetStorage.remove = async () => {}', ctx);
  return ctx;
}
const plain = value => JSON.parse(JSON.stringify(value));

test('first visit receives independent Tibo and Los Angeles defaults with valid placements', async () => {
  const ctx = context();
  const data = plain(await runInContext('storage.load()', ctx));
  assert.equal(data.widgets.length, 2);
  const clock = data.widgets.find(w => w.type === 'clock');
  const twitter = data.widgets.find(w => w.type === 'twitter');
  assert.deepEqual(clock.config, { timezone: 'America/Los_Angeles', style: 'digital', hour12: false, seconds: true });
  assert.equal(twitter.config.username, 'thsottiaux');
  assert.equal(clock.size, 'large'); assert.equal(twitter.size, 'large');
  assert.notEqual(clock.id, twitter.id);
  assert.deepEqual(kit.normalize(data.widgets), data.widgets);
  for (const w of data.widgets) {
    const [width, height] = kit.widgetSize(w);
    const desired = { x: 16 + w.position.x * (2552 - width - 32), y: w.position.y, width, height };
    assert.deepEqual(kit.placeRect(desired, [], 2552), desired);
  }
  ctx.first = data;
  runInContext('first.widgets[0].config.timezone = "UTC"; first.widgets.pop()', ctx);
  assert.equal(plain(runInContext('createDefaultData()', ctx)).widgets.length, 2);
  assert.equal(plain(runInContext('createDefaultData()', ctx)).widgets[0].config.timezone, 'America/Los_Angeles');
});

test('existing configurations and imports without widgets stay empty', async () => {
  for (const version of [2, 3, 4]) {
    const saved = { version, groups: [{ id: 'mine', name: '我的分组' }], sites: [], settings: {} };
    const ctx = context(saved);
    const data = plain(await runInContext('storage.load()', ctx));
    assert.deepEqual(data.widgets, []);
    if (version >= 3) assert.equal(data.groups[0].name, '我的分组');
    ctx.imported = saved;
    assert.deepEqual(plain(await runInContext('storage.import(imported)', ctx)).widgets, []);
  }
});

test('deleting defaults stays deleted after reload; custom widgets and positions survive export/import', async () => {
  const ctx = context();
  ctx.saved = plain(await runInContext('storage.load()', ctx));
  ctx.saved.widgets = [];
  await runInContext('storage.save(saved)', ctx);
  assert.deepEqual(plain(await runInContext('storage.load()', ctx)).widgets, []);
  ctx.saved.widgets = [{ id: 'my-clock', type: 'clock', size: 'small',
    position: { x: 0.7, y: 650 }, config: { timezone: 'Europe/London', style: 'analog', hour12: true, seconds: false } }];
  await runInContext('storage.save(saved)', ctx);
  ctx.imported = JSON.parse(await runInContext('storage.export()', ctx));
  assert.deepEqual(plain(await runInContext('storage.import(imported)', ctx)).widgets, ctx.saved.widgets);
  assert.deepEqual(plain(await runInContext('storage.load()', ctx)).widgets, ctx.saved.widgets);
});
