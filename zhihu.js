(function (root) {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const formatCount = value => value === null ? '—' : value >= 100000000 ? `${(value / 100000000).toFixed(1).replace(/\.0$/, '')}亿` : value >= 10000 ? `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万` : String(value);
  function normalizeQuestions(payload) {
    if (!Array.isArray(payload?.data)) throw new Error('invalid');
    const seen = new Set();
    const items = payload.data.slice(0, 100).flatMap(item => {
      const q = item?.question, r = item?.reaction;
      // IDs are strings: Zhihu question IDs can exceed JavaScript's safe integer range.
      if (typeof q?.id !== 'string' || !/^\d{1,25}$/.test(q.id) || typeof q.title !== 'string' || !q.title.trim() || seen.has(q.id)) return [];
      seen.add(q.id);
      return [{ id: q.id, title: q.title.trim().slice(0, 500), url: `https://www.zhihu.com/question/${q.id}`, views: count(r?.pv), answers: count(r?.answer_num) }];
    }).slice(0, 10);
    if (payload.data.length && !items.length) throw new Error('invalid');
    return items;
  }
  function listMarkup(items) {
    return items.map((item, index) => `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer"><span class="zhihu-rank">${String(index + 1).padStart(2, '0')}</span><span class="zhihu-question"><strong>${escape(item.title)}</strong><span>${formatCount(item.views)} 浏览<span aria-hidden="true"> · </span>${formatCount(item.answers)} 回答</span></span><span class="zhihu-arrow" aria-hidden="true">↗</span></a></li>`).join('');
  }
  class ZhihuClient {
    constructor({ fetcher = (...args) => root.fetch(...args), timeoutMs = 15000, now = Date.now } = {}) {
      this.fetcher = fetcher; this.timeoutMs = timeoutMs; this.now = now;
      this.views = new Set(); this.pending = null; this.state = null;
    }
    subscribe(update) {
      this.views.add(update);
      if (this.state) update(this.state); else this.load();
      return () => {
        this.views.delete(update);
        if (!this.views.size) {
          const request = this.pending; this.pending = null; this.state = null;
          if (request) { root.clearTimeout(request.timer); request.controller.abort(); }
        }
      };
    }
    emit(state) { this.state = state; for (const update of this.views) update(state); }
    load() {
      if (this.pending) return this.pending.promise;
      const request = { controller: new AbortController() };
      this.pending = request; this.emit({ loading: true });
      const finish = state => {
        if (this.pending !== request) return;
        this.pending = null; root.clearTimeout(request.timer); this.emit(state);
      };
      request.timer = root.setTimeout(() => { finish({ error: '请求超时，请稍后重试。' }); request.controller.abort(); }, this.timeoutMs);
      request.promise = (async () => {
        try {
          const response = await this.fetcher('/api/zhihu/hot', { signal: request.controller.signal, cache: 'no-store', credentials: 'omit' });
          if (!response.ok) {
            let error;
            try { error = (await response.json()).error; } catch {}
            throw new Error(error === 'upstream_denied' ? error : String(response.status));
          }
          const items = normalizeQuestions(await response.json());
          finish({ items, updatedAt: this.now() });
        } catch (error) {
          finish({ error: error.message === 'upstream_denied' ? '知乎暂未允许服务器读取热榜，可通过下方链接前往知乎查看。' : error.message === '429' ? '知乎暂时限制了请求，请稍后再试。' : error.message === '404' ? '当前服务未启用热榜接口，请使用完整服务启动页面。' : error.message === 'invalid' ? '热榜数据格式异常，请稍后重试。' : '暂时无法读取知乎热榜，请稍后重试。' });
        }
      })();
      return request.promise;
    }
  }
  const client = new ZhihuClient(), mounts = new WeakMap();
  function cleanup(card) {
    const container = card.querySelector('.widget-content'), mount = mounts.get(container);
    if (mount) { mounts.delete(container); mount.unsubscribe(); container.replaceChildren(); }
  }
  function render(widget, container) {
    if (mounts.has(container)) return;
    const mount = {}; mounts.set(container, mount);
    container.innerHTML = `<div class="zhihu-heading"><span class="zhihu-brand"><span class="zhihu-mark" aria-hidden="true">知</span><span><strong>知乎热榜</strong><small>大家正在讨论</small></span></span><button class="zhihu-refresh" type="button" aria-label="刷新知乎热榜" title="刷新热榜">↻</button></div><div class="zhihu-status" role="status" aria-live="polite"></div><div class="zhihu-scroll" tabindex="0" role="region" aria-label="知乎热榜问题列表"><ol class="zhihu-list"></ol></div><div class="zhihu-footer"><a href="https://www.zhihu.com/creator/search-question/init" target="_blank" rel="noopener noreferrer">知乎 · 小时热题 ↗</a><span class="zhihu-updated"></span></div>`;
    const status = container.querySelector('.zhihu-status'), list = container.querySelector('.zhihu-list'), refresh = container.querySelector('.zhihu-refresh'), updated = container.querySelector('.zhihu-updated');
    mount.unsubscribe = client.subscribe(state => {
      if (mounts.get(container) !== mount || !container.isConnected) return;
      refresh.disabled = !!state.loading;
      status.hidden = !!state.items?.length;
      list.innerHTML = state.items ? listMarkup(state.items) : '';
      updated.textContent = state.updatedAt ? `${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(state.updatedAt)} 获取` : '';
      if (state.loading) status.innerHTML = '<span class="twitter-loading" aria-hidden="true"></span><strong>正在读取热榜</strong><p>看看此刻大家关心什么。</p>';
      else if (state.error) status.innerHTML = `<strong>热榜暂时未能加载</strong><p>${escape(state.error)}</p><button type="button" class="zhihu-refresh">重新加载</button>`;
      else if (!state.items.length) status.innerHTML = '<strong>暂无热题</strong><p>稍后再来看看。</p><button type="button" class="zhihu-refresh">重新加载</button>';
    });
  }
  const api = { ZhihuClient, normalizeQuestions, formatCount, listMarkup, render, cleanup, retry: () => client.load() };
  root.ZhihuKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
