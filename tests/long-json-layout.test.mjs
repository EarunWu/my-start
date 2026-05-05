import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");

function declarationsFor(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rulePattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(rulePattern)]
    .flatMap((match) => match[1].split(";"))
    .map((declaration) => declaration.trim())
    .filter(Boolean);
}

function hasDeclaration(selector, property, value) {
  return declarationsFor(selector).some((declaration) => {
    const [rawProperty, ...rawValueParts] = declaration.split(":");
    const actualProperty = rawProperty?.trim();
    const actualValue = rawValueParts.join(":").trim();
    return actualProperty === property && (value === undefined || actualValue === value);
  });
}

test("long JSON preview stays constrained inside the JSON panel instead of widening the page", () => {
  for (const selector of [".page-shell", ".start-panel", ".site-section", ".json-panel"]) {
    assert.equal(
      hasDeclaration(selector, "min-width", "0"),
      true,
      `${selector} should be allowed to shrink around long JSON content`,
    );
  }

  assert.equal(hasDeclaration(".json-output", "min-width", "0"), true);
  assert.equal(hasDeclaration(".json-output", "max-width", "100%"), true);
  assert.equal(hasDeclaration(".json-output", "overflow", "auto"), true);
  assert.equal(hasDeclaration(".json-output", "white-space", "pre-wrap"), true);
  assert.equal(hasDeclaration(".json-output", "overflow-wrap", "anywhere"), true);
});
