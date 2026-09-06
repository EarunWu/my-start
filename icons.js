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
      image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0 ? {
        width: image.naturalWidth,
        height: image.naturalHeight,
        // Cross-origin image bytes are not readable; the URL is a format hint.
        vector: /^data:image\/svg\+xml[;,]/i.test(url) || /\.svg$/i.test(new URL(url, 'https://local.invalid').pathname),
      } : false);
      image.onerror = () => finish(false);
      image.src = url;
    });
  }

  function customUrl(value) {
    return /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)[;,]/i.test(value || '')
      ? value : safeUrl(value);
  }

  class Resolver {
    constructor({ storage, probe = probeImage, now = Date.now, pixelRatio = root.devicePixelRatio || 1 } = {}) {
      this.storage = storage;
      this.probe = probe;
      this.now = now;
      this.targetSize = Math.max(96, Math.ceil(36 * pixelRatio));
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
      const conventional = custom === `${origin}/favicon.ico` || custom === `${origin}/favicon.svg`;
      const preferred = conventional ? [remembered, custom] : [custom, remembered];
      return [...new Set([...preferred, `${origin}/favicon.svg`, `${origin}/favicon.ico`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${this.targetSize > 128 ? 256 : 128}`].filter(Boolean))];
    }

    resolve(site, { force = false, onCandidate } = {}) {
      // Snapshot the inputs: editing a bookmark cannot change an in-flight lookup.
      site = { ...site };
      const page = safeUrl(site.url);
      if (!page) return Promise.resolve(null);
      const origin = new URL(page).origin;
      const key = JSON.stringify([origin, site.iconMode === 'custom' ? site.icon : '', force]);
      // Rendering may still be attaching a card when it subscribes to shared progress.
      const notify = (listener, result) => { queueMicrotask(() => {
        try { listener?.(result); } catch { /* A removed view must not stop other views. */ }
      }); };
      if (this.pending.has(key)) {
        const shared = this.pending.get(key);
        if (onCandidate) shared.listeners.add(onCandidate);
        if (shared.best) notify(onCandidate, shared.best);
        return shared.promise;
      }
      const request = { listeners: new Set(onCandidate ? [onCandidate] : []), best: null, promise: null };
      const revision = (this.revisions.get(origin) || 0) + 1;
      this.revisions.set(origin, revision);
      const custom = site.iconMode === 'custom' ? customUrl(site.icon) : '';
      const conventional = custom === `${origin}/favicon.ico` || custom === `${origin}/favicon.svg`;
      const publish = result => {
        request.best = result;
        for (const listener of request.listeners) notify(listener, result);
      };
      const saveBest = () => {
        const best = request.best;
        if (best && this.revisions.get(origin) === revision && best.url !== custom) this.remember(origin, best.url);
        return best;
      };
      const work = (async () => {
        for (const url of this.candidates(site)) {
          const failedAt = this.failures.get(url);
          if (!force && failedAt !== undefined && this.now() - failedAt < FAILURE_TTL) continue;
          let info;
          try { info = await this.probe(url); } catch { /* Try the next source. */ }
          if (Number.isFinite(info?.width) && info.width > 0 && Number.isFinite(info?.height) && info.height > 0) {
            this.failures.delete(url);
            const size = Math.min(info.width, info.height);
            const score = info.vector ? Infinity : size;
            const result = { url, width: info.width, height: info.height, vector: !!info.vector,
              lowResolution: !info.vector && size < this.targetSize,
              fallback: !!custom && url !== custom, upgraded: !!custom && conventional && url !== custom };
            if (!request.best || score > (request.best.vector ? Infinity : Math.min(request.best.width, request.best.height))) publish(result);
            // Preserve intentionally chosen artwork. A conventional site favicon may be upgraded.
            if (url === custom && !conventional) return result;
            if (!result.lowResolution) return saveBest();
            continue;
          }
          this.failures.set(url, this.now());
          if (this.failures.size > 500) this.failures.delete(this.failures.keys().next().value);
        }
        return saveBest();
      })();
      request.promise = work;
      this.pending.set(key, request);
      work.finally(() => {
        request.listeners.clear();
        if (this.pending.get(key) === request) this.pending.delete(key);
      });
      return work;
    }
  }

  const api = { Resolver, probeImage, safeUrl };
  root.SiteIcons = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
