import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('cross-origin and file icons skip byte fetching; same-origin HTTP icons remain cacheable', async () => {
  let fetches = 0;
  const ctx = createContext({ document: { addEventListener() {} }, URL, console,
    location: { href: 'file:///E:/project/web-start/index.html' },
    fetch: () => { fetches++; throw new Error('Unexpected icon fetch'); },
  });
  runInContext(source, ctx);
  assert.equal(runInContext("canCacheIcon('https://www.google.com/s2/favicons?domain=x.com&sz=64')", ctx), false);
  assert.equal(await runInContext("siteIconCacheStorage.refresh('https://www.google.com/s2/favicons?domain=x.com&sz=64')", ctx), null);
  ctx.location.href = 'http://127.0.0.1:4173/';
  assert.equal(await runInContext("siteIconCacheStorage.refresh('https://www.google.com/s2/favicons?domain=x.com&sz=64')", ctx), null);
  assert.equal(runInContext("canCacheIcon('/assets/logo.svg')", ctx), true);
  assert.equal(runInContext("canCacheIcon('http://127.0.0.1:4174/logo.svg')", ctx), false);
  assert.equal(runInContext("canCacheIcon('data:image/png;base64,AA==')", ctx), false);
  assert.equal(fetches, 0);
});
