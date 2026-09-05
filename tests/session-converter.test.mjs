import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  convertSessionText,
  formatCodexTokenFile,
  getCodexTokenDownloadName,
} = require("../session-converter.js");

test("converts a full session JSON string into codex token JSON data", () => {
  const sessionText = JSON.stringify({
    accessToken: "fake-access-token",
    account: {
      id: "fake-account-id",
      planType: "plus",
    },
    user: {
      email: "person@example.com",
    },
  });

  assert.deepEqual(convertSessionText(sessionText), {
    access_token: "fake-access-token",
    account_id: "fake-account-id",
    type: "codex",
  });
});

test("formats converted codex token data as pretty JSON", () => {
  const sessionText = JSON.stringify({
    accessToken: "another-fake-token",
    account: {
      id: "another-fake-account",
    },
  });

  const formatted = formatCodexTokenFile(sessionText);

  assert.equal(
    formatted,
    [
      "{",
      '  "access_token": "another-fake-token",',
      '  "account_id": "another-fake-account",',
      '  "type": "codex"',
      "}",
    ].join("\n"),
  );
});

test("reports a helpful error when required session fields are missing", () => {
  assert.throws(
    () => convertSessionText(JSON.stringify({ account: {} })),
    /缺少 accessToken/,
  );

  assert.throws(
    () => convertSessionText(JSON.stringify({ accessToken: "fake-token" })),
    /缺少 account\.id/,
  );
});

test("uses the email username as the converted download file name", () => {
  const sessionText = JSON.stringify({
    accessToken: "fake-token",
    account: {
      id: "fake-account-id",
    },
    user: {
      email: "person.name+codex@example.com",
    },
  });

  assert.equal(getCodexTokenDownloadName(sessionText), "person.name+codex.json");
});

test("falls back to account id when the session input has no email", () => {
  const sessionText = JSON.stringify({
    accessToken: "fake-token",
    account: {
      id: "fake-account-id",
    },
  });

  assert.equal(getCodexTokenDownloadName(sessionText), "fake-account-id.json");
});
