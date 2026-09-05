import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

function setup(query = "") {
  const context = createContext({
    document: { addEventListener() {} },
    window: { location: { href: "" } },
    console: { error() {} },
    structuredClone,
  });
  runInContext(source, context);
  context.query = query;
  runInContext(`
    state.data = { settings: {}, sites: [], groups: [] };
    elements.searchInput = { value: query, focus() {} };
    globalThis.saved = null;
    globalThis.message = "";
    closeSearchEngineMenu = () => {};
    closeSearchWheel = () => {};
    showToast = (text) => { globalThis.message = text; };
    saveData = async (data) => { globalThis.saved = data; state.data = data; };
    getVisibleSites = () => { throw new Error("Explicit engine search must bypass bookmark matching"); };
  `, context);
  return context;
}

test("wheel persists each selected engine and searches the encoded input directly", async () => {
  const query = " GitHub 中文 & a/b? ";
  for (const [id, prefix] of [
    ["google", "https://www.google.com/search?q="],
    ["bing", "https://www.bing.com/search?q="],
    ["baidu", "https://www.baidu.com/s?wd="],
    ["grok", "https://grok.com/?q="],
    ["chatgpt", "https://chatgpt.com/?hints=search&q="],
  ]) {
    const context = setup(query);
    await runInContext(`selectSearchEngine("${id}", { search: true })`, context);
    assert.equal(context.saved.settings.searchEngineId, id);
    assert.equal(context.window.location.href, prefix + encodeURIComponent(query.trim()));
  }
});

test("blank wheel input switches engine without navigating", async () => {
  const context = setup("   ");
  await runInContext('selectSearchEngine("bing", { search: true })', context);
  assert.equal(context.saved.settings.searchEngineId, "bing");
  assert.equal(context.window.location.href, "");
  assert.match(context.message, /Bing/);
});

test("the existing left menu still only switches the engine", async () => {
  const context = setup("hello");
  await runInContext('selectSearchEngine("google")', context);
  assert.equal(context.saved.settings.searchEngineId, "google");
  assert.equal(context.window.location.href, "");
});

test("unknown engines do not save or navigate", async () => {
  const context = setup("hello");
  await runInContext('selectSearchEngine("unknown", { search: true })', context);
  assert.equal(context.saved, null);
  assert.equal(context.window.location.href, "");
});

test("storage failure is reported without silently leaving the page", async () => {
  const context = setup("hello");
  runInContext('saveData = async () => { throw new Error("Storage unavailable"); }', context);
  await runInContext('selectSearchEngine("bing", { search: true })', context);
  assert.match(context.message, /保存失败/);
  assert.equal(context.window.location.href, "");
});
