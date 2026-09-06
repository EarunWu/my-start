(function (root) {
  'use strict';
  const SUCCESS_TTL = 30 * 86400000;
  const FAILURE_TTL = 5 * 60000;
  const CACHE_KEY = 'my-start:icon-sources:v1';

  function safeUrl(value, base) {
    try {
      const url = new URL(value, base);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function probeImage(url, timeout = 2500, ImageClass = root.Image) {
    return new Promise(resolve => {
      const image = new ImageClass();
      let settled = false;
      const finish = ok => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (!ok) image.removeAttribute('src');
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeout);
      image.referrerPolicy = 'no-referrer';
      image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => finish(false);
      image.src = url;
    });
  }

  function customUrl(value) {
    return /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)[;,]/i.test(value || '')
      ? value : safeUrl(value);
  }

  class Resolver {
    constructor({ storage, probe = probeImage, now = Date.now } = {}) {
      this.storage = storage;
      this.probe = probe;
      this.now = now;
      this.entries = {};
      this.pending = new Map();
      this.failures = new Map();
      this.revisions = new Map();
      try {
        const saved = JSON.parse(storage?.getItem(CACHE_KEY) || '{}');
        for (const [origin, entry] of Object.entries(saved).slice(-200)) {
          if (safeUrl(origin) && safeUrl(entry?.url) && Number.isFinite(entry?.at) &&
              entry.at <= now() && now() - entry.at < SUCCESS_TTL) this.entries[origin] = entry;
        }
      } catch { /* Storage is optional. */ }
    }

    remember(origin, url) {
      this.entries[origin] = { url, at: this.now() };
      this.entries = Object.fromEntries(Object.entries(this.entries)
        .sort((a, b) => b[1].at - a[1].at).slice(0, 200));
      try { this.storage?.setItem(CACHE_KEY, JSON.stringify(this.entries)); } catch { /* Keep the in-memory result. */ }
    }

    candidates(site) {
      const page = safeUrl(site.url);
      if (!page) return [];
      const { origin, hostname } = new URL(page);
      const custom = site.iconMode === 'custom' ? customUrl(site.icon) : '';
      const saved = this.entries[origin];
      const remembered = saved && this.now() - saved.at < SUCCESS_TTL ? saved.url : '';
      return [...new Set([custom, remembered, `${origin}/favicon.ico`, `${origin}/favicon.svg`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`].filter(Boolean))];
    }

    resolve(site, { force = false } = {}) {
      // Snapshot the inputs: editing a bookmark cannot change an in-flight lookup.
      site = { ...site };
      const page = safeUrl(site.url);
      if (!page) return Promise.resolve(null);
      const origin = new URL(page).origin;
      const key = JSON.stringify([origin, site.iconMode === 'custom' ? site.icon : '', force]);
      if (this.pending.has(key)) return this.pending.get(key);
      const revision = (this.revisions.get(origin) || 0) + 1;
      this.revisions.set(origin, revision);
      const work = (async () => {
        for (const url of this.candidates(site)) {
          const failedAt = this.failures.get(url);
          if (!force && failedAt !== undefined && this.now() - failedAt < FAILURE_TTL) continue;
          let ok = false;
          try { ok = await this.probe(url); } catch { /* Try the next source. */ }
          if (ok) {
            this.failures.delete(url);
            // Custom choices belong to the bookmark, not every bookmark on this domain.
            if (this.revisions.get(origin) === revision &&
                !(site.iconMode === 'custom' && url === customUrl(site.icon))) this.remember(origin, url);
            return { url, fallback: site.iconMode === 'custom' && url !== customUrl(site.icon) };
          }
          this.failures.set(url, this.now());
          if (this.failures.size > 500) this.failures.delete(this.failures.keys().next().value);
        }
        return null;
      })();
      this.pending.set(key, work);
      work.finally(() => { if (this.pending.get(key) === work) this.pending.delete(key); });
      return work;
    }
  }

  const api = { Resolver, probeImage, safeUrl };
  root.SiteIcons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
