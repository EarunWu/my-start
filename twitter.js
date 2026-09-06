(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const handle = value => typeof value === 'string' && /^[a-z0-9_]{1,15}$/i.test(value) ? value : '';
  const mediaUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['pbs.twimg.com', 'video.twimg.com'].includes(url.hostname) && !url.username && !url.password && !url.port ? url.href : '';
    } catch { return ''; }
  };
  function chineseTranslation(value) {
    return value && typeof value.text === 'string' && value.text.trim() && /^zh(?:-|$)/i.test(value.target_lang || '')
      ? value.text.slice(0, 30000) : '';
  }
  function normalizePost(value, withQuote = true) {
    if (!value || value.type !== 'status' || typeof value.id !== 'string' || !/^\d{1,25}$/.test(value.id) || !handle(value.author?.screen_name) || typeof value.text !== 'string') return null;
    const timestamp = Date.parse(value.created_at);
    if (!Number.isFinite(timestamp)) return null;
    const username = value.author.screen_name;
    const photos = (Array.isArray(value.media?.photos) ? value.media.photos : []).slice(0, 4)
      .map(p => ({ url: mediaUrl(p?.url), alt: typeof p?.altText === 'string' ? p.altText.slice(0, 500) : '动态配图' })).filter(p => p.url);
    const clip = Array.isArray(value.media?.videos) ? value.media.videos[0] : null;
    const video = clip && mediaUrl(clip.url) ? { url: mediaUrl(clip.url), poster: mediaUrl(clip.thumbnail_url) } : null;
    return {
      id: value.id, username, name: typeof value.author.name === 'string' ? value.author.name.slice(0, 100) : username,
      avatar: mediaUrl(value.author.avatar_url), url: `https://x.com/${username}/status/${value.id}`,
      text: value.text.slice(0, 30000), language: typeof value.lang === 'string' ? value.lang : '',
      translation: chineseTranslation(value.translation), timestamp, photos, video,
      quote: withQuote ? normalizePost(value.quote, false) : null,
      reply: !!value.replying_to, repost: !!value.reposted_by,
      stats: ['replies', 'reposts', 'likes'].map(key => Number.isFinite(value[key]) && value[key] >= 0 ? Math.floor(value[key]) : null),
    };
  }
  function latestPost(data, username) {
    if (data?.code !== 200 || !Array.isArray(data.results)) throw new Error('invalid');
    return data.results.map(value => normalizePost(value)).filter(post => post && !post.reply && !post.repost && post.username.toLowerCase() === username.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp || (BigInt(a.id) < BigInt(b.id) ? 1 : BigInt(a.id) > BigInt(b.id) ? -1 : 0))[0] || null;
  }
  function linkedText(text) {
    return text.split(/(https?:\/\/[^\s<>"']+)/g).map(part => /^https?:\/\//.test(part)
      ? `<a href="${escape(part)}" target="_blank" rel="noopener noreferrer">${escape(part)}</a>` : escape(part)).join('');
  }
  function textMarkup(post, quote = false) {
    const format = text => quote ? escape(text.slice(0, 600)) : linkedText(text);
    const className = quote ? '' : ' class="twitter-post-text"';
    return post.translation
      ? `<p${className} data-twitter-text="translation" lang="zh-CN">${format(post.translation)}</p><p${className} data-twitter-text="original" hidden>${format(post.text)}</p>`
      : `<p${className}>${format(post.text)}</p>`;
  }
  function postMarkup(post) {
    const date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(post.timestamp);
    const avatar = post.avatar ? `<img src="${escape(post.avatar)}" alt="" width="42" height="42" loading="lazy" referrerpolicy="no-referrer">` : `<span>${escape(post.name.slice(0, 1))}</span>`;
    const photos = post.photos.length ? `<div class="twitter-photos twitter-photos-${post.photos.length}">${post.photos.map(p => `<a href="${escape(p.url)}" target="_blank" rel="noopener noreferrer" aria-label="查看配图"><img src="${escape(p.url)}" alt="${escape(p.alt)}" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')}</div>` : '';
    const video = post.video ? `<video class="twitter-video" controls playsinline preload="none" ${post.video.poster ? `poster="${escape(post.video.poster)}"` : ''} src="${escape(post.video.url)}" aria-label="动态视频"><a href="${post.url}" target="_blank" rel="noopener noreferrer">在 X 查看视频</a></video>` : '';
    const quote = post.quote ? `<a class="twitter-quote" href="${post.quote.url}" target="_blank" rel="noopener noreferrer"><strong>${escape(post.quote.name)} <span>@${escape(post.quote.username)}</span></strong>${textMarkup(post.quote, true)}</a>` : '';
    const translationControl = post.translation || post.quote?.translation
      ? '<div class="twitter-translation-bar"><span class="twitter-language-label">中文译文 · 机器翻译</span><button class="twitter-translation-toggle" type="button" aria-label="查看原文">查看原文</button></div>'
      : post.translationUnavailable ? '<div class="twitter-translation-bar"><span>翻译暂不可用，已显示原文</span></div>' : '';
    const icons = ['<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-9.5a8.5 8.5 0 0 1 18 0Z"/>', '<path d="m4 8 3-3 3 3M7 5v11h8m5 0-3 3-3-3m3 3V8h-8"/>', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'];
    const labels = ['回复', '转发', '喜欢'];
    const counts = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 });
    const stats = post.stats.map((n, i) => n === null ? '' : `<span aria-label="${labels[i]} ${n}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg>${counts.format(n)}</span>`).join('');
    return `<article class="twitter-post"><a class="twitter-author" href="https://x.com/${post.username}" target="_blank" rel="noopener noreferrer"><span class="twitter-avatar">${avatar}</span><span class="twitter-author-names"><strong>${escape(post.name)}</strong><span>@${escape(post.username)}</span></span></a>${textMarkup(post)}${translationControl}${photos}${video}${quote}<a class="twitter-post-date" href="${post.url}" target="_blank" rel="noopener noreferrer"><time datetime="${new Date(post.timestamp).toISOString()}">${date}</time><span>在 X 查看 ↗</span></a>${stats ? `<div class="twitter-stats">${stats}</div>` : ''}</article>`;
  }
  function toggleTranslation(card) {
    const button = card.querySelector('.twitter-translation-toggle');
    if (!button) return;
    const showOriginal = button.dataset.original !== 'true';
    button.dataset.original = String(showOriginal);
    button.textContent = showOriginal ? '查看译文' : '查看原文';
    button.setAttribute('aria-label', button.textContent);
    card.querySelector('.twitter-language-label').textContent = showOriginal ? '原文' : '中文译文 · 机器翻译';
    for (const text of card.querySelectorAll('[data-twitter-text]')) {
      text.hidden = text.dataset.twitterText !== (showOriginal ? 'original' : 'translation');
    }
  }

  // Only in-flight requests are shared. Completed responses are not cached.
  class TwitterClient {
    constructor({ fetcher = (...args) => root.fetch(...args), timeoutMs = 15000 } = {}) {
      this.fetcher = fetcher; this.timeoutMs = timeoutMs; this.pending = new Map(); this.views = new Set();
    }
    subscribe(username, update) {
      const key = username.toLowerCase(), view = { key, update };
      this.views.add(view); this.load(username);
      return () => {
        this.views.delete(view);
        if (![...this.views].some(v => v.key === key)) {
          const request = this.pending.get(key);
          if (request) { this.pending.delete(key); request.controller.abort(); root.clearTimeout(request.timer); }
        }
      };
    }
    emit(key, state) { for (const view of this.views) if (view.key === key) view.update(state); }
    load(username) {
      if (!handle(username)) return;
      const key = username.toLowerCase();
      if (this.pending.has(key)) { this.emit(key, { loading: true }); return; }
      const request = { controller: new AbortController(), timer: null };
      this.pending.set(key, request); this.emit(key, { loading: true });
      const finish = state => {
        if (this.pending.get(key) !== request) return;
        this.pending.delete(key); root.clearTimeout(request.timer); this.emit(key, state);
      };
      request.timer = root.setTimeout(() => {
        finish(request.post ? { post: { ...request.post, translationUnavailable: true } } : { error: '请求超时，请稍后重试。' });
        request.controller.abort();
      }, this.timeoutMs);
      (async () => {
        try {
          const response = await this.fetcher(`https://api.fxtwitter.com/2/profile/${encodeURIComponent(username)}/statuses`, { signal: request.controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.json();
          if (data?.code !== 200) throw new Error(String(data?.code || 'invalid'));
          const post = latestPost(data, username);
          if (this.pending.get(key) !== request) return;
          request.post = post;
          if (post && post.text.trim() && !post.translation && !/^zh(?:-|$)/i.test(post.language)) {
            // Translate only the selected post, not every item in the timeline.
            this.emit(key, { loading: true, translating: true });
            try {
              const translatedResponse = await this.fetcher(`https://api.fxtwitter.com/2/status/${post.id}?lang=zh-cn`, { signal: request.controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
              if (!translatedResponse.ok) throw new Error('translation unavailable');
              const translatedData = await translatedResponse.json();
              if (this.pending.get(key) !== request) return;
              if (translatedData?.code !== 200 || translatedData.status?.id !== post.id) throw new Error('translation unavailable');
              post.translation = chineseTranslation(translatedData.status.translation);
              if (post.quote && translatedData.status.quote?.id === post.quote.id) post.quote.translation = chineseTranslation(translatedData.status.quote.translation);
              post.translationUnavailable = !post.translation;
            } catch { post.translationUnavailable = true; }
          }
          finish({ post });
        } catch (error) {
          finish({ error: error.message === '429' ? 'FxTwitter 暂时限制了请求，请稍后重试。' : error.message === '404' ? '未找到这个账号，或该账号的动态暂不可用。' : error.message === 'invalid' ? '动态数据格式异常，请稍后重试。' : '暂时无法读取动态，请检查网络后重试。' });
        }
      })();
    }
  }
  const client = new TwitterClient(), mounts = new WeakMap();
  function cleanup(card) {
    const container = card.querySelector('.widget-content'), mount = mounts.get(container);
    if (mount) { mounts.delete(container); mount.unsubscribe?.(); container.replaceChildren(); }
  }
  function render(widget, container) {
    const username = handle(widget.config.username), key = username.toLowerCase();
    if (mounts.get(container)?.key === key) return;
    mounts.get(container)?.unsubscribe?.();
    const mount = { key }; mounts.set(container, mount);
    container.innerHTML = `<div class="twitter-heading"><span class="twitter-brand"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.6L5.2 22H2l7.4-8.6L1.8 2h6.4l4.5 6.9L18.9 2Zm-1.1 18h1.8L7.2 3.9H5.3L17.8 20Z"/></svg><strong>账号动态</strong></span><button class="twitter-refresh" type="button" aria-label="刷新 X 动态" title="刷新动态">↻</button></div><div class="twitter-status" role="status" aria-live="polite"></div><div class="twitter-scroll" tabindex="0" role="region" aria-label="X 动态内容"></div><div class="twitter-footer"><a href="https://docs.fxembed.com/" target="_blank" rel="noopener noreferrer">由 FxTwitter 提供</a><a href="https://x.com/${username}" target="_blank" rel="noopener noreferrer">@${escape(username)}</a></div>`;
    const status = container.querySelector('.twitter-status'), content = container.querySelector('.twitter-scroll'), refresh = container.querySelector('.twitter-refresh');
    if (!username) { status.textContent = '请在组件设置中填写 X 用户名'; refresh.disabled = true; return; }
    mount.unsubscribe = client.subscribe(username, state => {
      if (mounts.get(container) !== mount || !container.isConnected) return;
      refresh.disabled = !!state.loading;
      status.hidden = !!state.post;
      // Drop displayed data when refreshing; there is no stale-result fallback.
      content.innerHTML = state.post ? postMarkup(state.post) : '';
      if (state.loading) status.innerHTML = `<span class="twitter-loading" aria-hidden="true"></span><strong>${state.translating ? '正在翻译为中文' : '正在读取动态'}</strong><p>稍等片刻，看看有什么新鲜事。</p>`;
      else if (state.error) status.innerHTML = `<span class="twitter-status-icon" aria-hidden="true">↗</span><strong>暂时无法显示动态</strong><p>${escape(state.error)}</p><button class="twitter-refresh" type="button">重新加载</button>`;
      else if (!state.post) status.innerHTML = '<span class="twitter-status-icon" aria-hidden="true">✧</span><strong>暂未找到发布的动态</strong><p>本次返回列表中没有该账号的非转发、非回复动态。</p><button class="twitter-refresh" type="button">重新加载</button>';
    });
  }
  function retry(widget) { client.load(widget.config.username); }
  const api = { TwitterClient, latestPost, normalizePost, postMarkup, render, cleanup, retry, toggleTranslation };
  root.FxTwitterKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
