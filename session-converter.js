(function attachSessionConverter(root) {
  "use strict";

  const EMAIL_PATTERN = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/i;

  function parseSessionJson(text) {
    const trimmed = String(text || "").trim();

    if (!trimmed) {
      throw new Error("请输入 session JSON 文本。");
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("session JSON 必须是对象。");
      }
      return parsed;
    } catch (error) {
      if (error.message === "session JSON 必须是对象。") {
        throw error;
      }
      throw new Error("JSON 解析失败，请检查输入内容。");
    }
  }

  function readRequiredString(value, path) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`缺少 ${path}。`);
    }
    return value;
  }

  function findEmailInString(value) {
    const match = value.match(EMAIL_PATTERN);
    return match?.[0] || "";
  }

  function findEmail(value) {
    if (typeof value === "string") {
      return findEmailInString(value);
    }

    if (!value || typeof value !== "object") {
      return "";
    }

    for (const item of Object.values(value)) {
      const email = findEmail(item);
      if (email) {
        return email;
      }
    }

    return "";
  }

  function sanitizeDownloadNamePart(value) {
    const sanitized = String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 120);

    return sanitized || "kk";
  }

  function convertSessionText(text) {
    const session = parseSessionJson(text);

    return {
      access_token: readRequiredString(session.accessToken, "accessToken"),
      account_id: readRequiredString(session.account?.id, "account.id"),
      type: "codex",
    };
  }

  function formatCodexTokenFile(text) {
    return JSON.stringify(convertSessionText(text), null, 2);
  }

  function getCodexTokenDownloadName(text) {
    const session = parseSessionJson(text);
    const email = findEmail(session);
    const baseName = email ? email.split("@")[0] : readRequiredString(session.account?.id, "account.id");
    return `${sanitizeDownloadNamePart(baseName)}.json`;
  }

  const api = {
    convertSessionText,
    formatCodexTokenFile,
    getCodexTokenDownloadName,
  };

  root.SessionConverter = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
