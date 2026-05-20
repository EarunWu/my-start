import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("converter page exposes the expected local conversion controls", async () => {
  const html = await readFile(new URL("../converter.html", import.meta.url), "utf8");

  for (const requiredMarkup of [
    'id="sessionInput"',
    'id="sessionFileInput"',
    'id="convertButton"',
    'id="clearConverterButton"',
    'id="convertedOutput"',
    'id="copyConvertedButton"',
    'id="downloadConvertedButton"',
    'src="session-converter.js"',
    'src="converter-page.js"',
  ]) {
    assert.match(html, new RegExp(requiredMarkup));
  }
});

test("main start page links to the session converter page", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /href="converter\.html"/);
  assert.match(html, /aria-label="打开转换工具"/);
});
