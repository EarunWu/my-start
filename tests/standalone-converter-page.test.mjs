import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("standalone converter page is self-contained for GitHub Pages", async () => {
  const html = await readFile(
    new URL("../standalone/session-converter.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /<title>Session 转换<\/title>/);
  assert.doesNotMatch(html, /<link\b[^>]*rel="stylesheet"/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=/);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
});

test("standalone converter page exposes conversion, copy, and download controls", async () => {
  const html = await readFile(
    new URL("../standalone/session-converter.html", import.meta.url),
    "utf8",
  );

  for (const requiredMarkup of [
    'id="sessionInput"',
    'id="sessionFileInput"',
    'id="convertButton"',
    'id="clearButton"',
    'id="outputJson"',
    'id="copyButton"',
    'id="downloadButton"',
    'id="copySessionUrlButton"',
    "复制session地址",
    "copySessionUrl",
    "https://chatgpt.com/api/auth/session",
    "反代可用的 JSON 格式",
    "仅在当前浏览器本地处理",
    "accessToken",
    "account.id",
    "access_token",
    "account_id",
    "getDownloadName",
    "email.split(\"@\")",
    "link.download = state.downloadName",
    "kk.json",
  ]) {
    assert.match(html, new RegExp(requiredMarkup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(html, />\s*下载 JSON\s*</);
  assert.doesNotMatch(html, /Codex 可用/);
  assert.doesNotMatch(html, />\s*下载 kk\.json\s*</);
});

test("GitHub Pages home links to the converter path without embedding the converter", async () => {
  const html = await readFile(
    new URL("../standalone/pages-home.html", import.meta.url),
    "utf8",
  );

  assert.match(html, /<title>EarunWu<\/title>/);
  assert.match(html, /href="session-converter\/"/);
  assert.doesNotMatch(html, /id="converterForm"/);
  assert.doesNotMatch(html, /id="sessionInput"/);
});
