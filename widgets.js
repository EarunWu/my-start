(function (root) {
  'use strict';
  const SIZES = { small: [200, 160], medium: [260, 220], large: [360, 280] };
  const WEATHER_SIZES = { small: [260, 210], medium: [320, 280], large: [420, 360] };
  const TWITTER_SIZES = { small: [320, 360], medium: [380, 440], large: [460, 520] };
  const widgetSize = widget => (widget.type === 'twitter' ? TWITTER_SIZES : widget.type === 'weather' ? WEATHER_SIZES : SIZES)[widget.size] || SIZES.medium;
  const GAP = 16;
  const WEATHER_TTL = 15 * 60 * 1000;
  const CACHE_KEY = 'my-start-weather-v1:';
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => `widget-${root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const finite = (n, fallback) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function validZone(zone) {
    try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return typeof zone === 'string' && !!zone; }
    catch { return false; }
  }
  const localZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const ZONE_CITIES = {
    'UTC': '协调世界时', 'Asia/Shanghai': '北京 / 上海', 'Asia/Hong_Kong': '香港', 'Asia/Macau': '澳门',
    'Asia/Taipei': '台北', 'Asia/Tokyo': '东京', 'Asia/Seoul': '首尔', 'Asia/Singapore': '新加坡',
    'Asia/Kuala_Lumpur': '吉隆坡', 'Asia/Bangkok': '曼谷', 'Asia/Ho_Chi_Minh': '胡志明市', 'Asia/Saigon': '胡志明市',
    'Asia/Jakarta': '雅加达', 'Asia/Manila': '马尼拉', 'Asia/Kolkata': '加尔各答 / 新德里', 'Asia/Calcutta': '加尔各答 / 新德里',
    'Asia/Dubai': '迪拜', 'Asia/Riyadh': '利雅得', 'Asia/Jerusalem': '耶路撒冷', 'Asia/Kathmandu': '加德满都', 'Asia/Katmandu': '加德满都',
    'Asia/Urumqi': '乌鲁木齐', 'Asia/Almaty': '阿拉木图', 'Asia/Karachi': '卡拉奇',
    'Europe/London': '伦敦', 'Europe/Paris': '巴黎', 'Europe/Berlin': '柏林', 'Europe/Rome': '罗马',
    'Europe/Madrid': '马德里', 'Europe/Amsterdam': '阿姆斯特丹', 'Europe/Zurich': '苏黎世',
    'Europe/Moscow': '莫斯科', 'Europe/Istanbul': '伊斯坦布尔', 'Europe/Athens': '雅典',
    'Europe/Helsinki': '赫尔辛基', 'Europe/Stockholm': '斯德哥尔摩', 'Europe/Lisbon': '里斯本',
    'America/New_York': '纽约', 'America/Chicago': '芝加哥', 'America/Denver': '丹佛',
    'America/Los_Angeles': '洛杉矶', 'America/Phoenix': '凤凰城', 'America/Anchorage': '安克雷奇',
    'America/Toronto': '多伦多', 'America/Vancouver': '温哥华', 'America/Mexico_City': '墨西哥城',
    'America/Sao_Paulo': '圣保罗', 'America/Argentina/Buenos_Aires': '布宜诺斯艾利斯', 'America/Buenos_Aires': '布宜诺斯艾利斯',
    'America/Lima': '利马', 'America/Bogota': '波哥大', 'America/Santiago': '圣地亚哥',
    'Australia/Sydney': '悉尼', 'Australia/Melbourne': '墨尔本', 'Australia/Brisbane': '布里斯班',
    'Australia/Perth': '珀斯', 'Australia/Adelaide': '阿德莱德', 'Australia/Darwin': '达尔文',
    'Pacific/Auckland': '奥克兰', 'Pacific/Chatham': '查塔姆群岛', 'Pacific/Honolulu': '檀香山 / 夏威夷',
    'Pacific/Fiji': '斐济', 'Pacific/Guam': '关岛', 'Africa/Cairo': '开罗',
    'Africa/Johannesburg': '约翰内斯堡', 'Africa/Nairobi': '内罗毕', 'Africa/Lagos': '拉各斯',
    'Africa/Casablanca': '卡萨布兰卡',
  };
  const zoneLabel = zone => ZONE_CITIES[zone] || zone.split('/').at(-1).replaceAll('_', ' ');
  function timezoneOptions(selected = localZone(), now = new Date()) {
    let supported = [];
    try { supported = Intl.supportedValuesOf?.('timeZone') || []; } catch {}
    return [...new Set([selected, localZone(), 'UTC', ...Object.keys(ZONE_CITIES), ...supported])].filter(validZone).map(zone => {
      const offset = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName').value.replace('GMT', 'UTC');
      const region = new Intl.DateTimeFormat('zh-CN', { timeZone: zone, timeZoneName: 'longGeneric' }).formatToParts(now).find(p => p.type === 'timeZoneName').value;
      return { zone, label: zoneLabel(zone), offset, search: `${zone} ${zone.replaceAll('_', ' ')} ${zoneLabel(zone)} ${region} ${offset}`.toLowerCase() };
    });
  }
  function filterTimezones(options, query) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return options.filter(option => words.every(word => option.search.includes(word)));
  }
  function normalize(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter(item => item && Object.hasOwn(registry, item.type)).map(item => {
      let id = typeof item.id === 'string' && item.id ? item.id : uid();
      if (seen.has(id)) id = uid();
      seen.add(id);
      return {
        id, type: item.type, size: Object.hasOwn(SIZES, item.size) ? item.size : 'medium',
        position: { x: clamp(finite(item.position?.x, 0), 0, 1), y: clamp(finite(item.position?.y, 104), 88, 100000) },
        config: registry[item.type].normalize(item.config || {}),
      };
    });
  }
  function overlaps(a, b, gap = GAP) {
    return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
      a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  }
  // The nearest feasible point lies on the desired axes or an obstacle boundary.
  function placeRect(desired, obstacles, canvasWidth) {
    const minX = GAP, maxX = Math.max(minX, canvasWidth - desired.width - GAP), minY = 96;
    const x = clamp(desired.x, minX, maxX), y = Math.max(minY, desired.y);
    const xs = new Set([x, minX, maxX]), ys = new Set([y, minY]);
    for (const o of obstacles) {
      xs.add(clamp(o.x - desired.width - GAP, minX, maxX));
      xs.add(clamp(o.x + o.width + GAP, minX, maxX));
      ys.add(Math.max(minY, o.y - desired.height - GAP));
      ys.add(Math.max(minY, o.y + o.height + GAP));
    }
    let best = null, distance = Infinity;
    for (const py of ys) for (const px of xs) {
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d >= distance) continue;
      const candidate = { ...desired, x: px, y: py };
      if (!obstacles.some(o => overlaps(candidate, o))) { best = candidate; distance = d; }
    }
    return best || { ...desired, x, y: Math.max(minY, ...obstacles.map(o => o.y + o.height + GAP)) };
  }
  function clockParts(now, timeZone) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  }
  function weatherKind(code) {
    if (code === 0) return ['晴', 'sun'];
    if ([1, 2].includes(code)) return ['晴间多云', 'partly'];
    if (code === 3) return ['阴', 'cloud'];
    if ([45, 48].includes(code)) return ['雾', 'fog'];
    if (code >= 95) return ['雷雨', 'storm'];
    if ([71, 73, 75, 77, 85, 86].includes(code)) return ['雪', 'snow'];
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['雨', 'rain'];
    return ['天气未知', 'cloud'];
  }
  function weatherIcon(code, night = false) {
    let kind = weatherKind(code)[1];
    if (night && kind === 'sun') kind = 'moon';
    const cloud = '<path d="M10 26h21a7 7 0 0 0 0-14 10 10 0 0 0-19-1 7.5 7.5 0 0 0-2 15Z"/>';
    const sun = '<circle cx="21" cy="20" r="8"/><path d="M21 3v4m0 26v4M4 20h4m26 0h4M9 8l3 3m18 18 3 3M9 32l3-3M30 11l3-3"/>';
    const paths = {
      sun, moon: '<path d="M31 27A15 15 0 0 1 15 6a15 15 0 1 0 16 21Z"/>',
      cloud, partly: '<circle cx="29" cy="10" r="6"/><path d="M29 1v2m9 7h2"/>' + cloud,
      rain: cloud + '<path d="m13 31-2 5m11-5-2 5m11-5-2 5"/>',
      snow: cloud + '<path d="M13 30v8m-3-6 6 4m0-4-6 4m18-6v8m-3-6 6 4m0-4-6 4"/>',
      fog: cloud + '<path d="M8 32h26M13 37h16"/>',
      storm: cloud + '<path d="m23 26-6 8h6l-4 7"/>',
    };
    return `<svg class="weather-symbol" viewBox="0 0 42 42" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</svg>`;
  }
  function validWeather(data) {
    return data && Number.isFinite(data.current?.temperature_2m) && Number.isFinite(data.current?.weather_code) &&
      typeof data.current?.time === 'string' && Array.isArray(data.daily?.time) && data.daily.time.length >= 5 &&
      ['weather_code', 'temperature_2m_max', 'temperature_2m_min'].every(k => Array.isArray(data.daily[k]) && data.daily[k].length >= 5 && data.daily[k].every(Number.isFinite));
  }
  class WeatherClient {
    constructor({ fetcher = (...args) => root.fetch(...args), storage = root.localStorage, now = Date.now, onChange = () => {} } = {}) {
      this.fetcher = fetcher; this.storage = storage; this.now = now; this.onChange = onChange;
      this.entries = new Map(); this.pending = new Map(); this.lastAttempt = new Map(); this.active = new Set();
    }
    key(city) { return `${city.latitude.toFixed(4)},${city.longitude.toFixed(4)}:${city.timezone}`; }
    entry(city) {
      const key = this.key(city);
      if (!this.entries.has(key)) {
        let cached;
        try { cached = JSON.parse(this.storage?.getItem(CACHE_KEY + key)); } catch {}
        this.entries.set(key, validWeather(cached?.data) && Number.isFinite(cached?.updatedAt) ? cached : {});
      }
      return this.entries.get(key);
    }
    async load(city, force = false) {
      const key = this.key(city), entry = this.entry(city);
      if (this.pending.has(key)) return this.pending.get(key).promise;
      if (!force && (entry.updatedAt && this.now() - entry.updatedAt < WEATHER_TTL || this.now() - (this.lastAttempt.get(key) || 0) < 60000)) return entry;
      this.lastAttempt.set(key, this.now());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ latitude: city.latitude, longitude: city.longitude,
        current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min', timezone: city.timezone, forecast_days: '5' });
      entry.loading = true;
      const request = { controller, promise: null };
      this.pending.set(key, request);
      const promise = (async () => {
        try {
          const response = await this.fetcher(url.toString(), { signal: controller.signal });
          if (!response.ok) throw new Error('weather unavailable');
          const data = await response.json();
          if (!validWeather(data)) throw new Error('invalid weather');
          if (controller.signal.aborted) return entry;
          Object.assign(entry, { data, updatedAt: this.now(), error: false });
          try { this.storage?.setItem(CACHE_KEY + key, JSON.stringify({ data, updatedAt: entry.updatedAt })); } catch {}
        } catch { if (this.pending.get(key) === request && this.active.has(key)) entry.error = true; }
        finally {
          clearTimeout(timeout);
          if (this.pending.get(key) === request) {
            entry.loading = false; this.pending.delete(key); this.onChange();
          }
        }
        return entry;
      })();
      request.promise = promise;
      return promise;
    }
    sync(cities) {
      this.active = new Set(cities.map(c => this.key(c)));
      for (const [key, pending] of this.pending) if (!this.active.has(key)) { pending.controller.abort(); this.pending.delete(key); this.lastAttempt.delete(key); this.entries.get(key).loading = false; }
      for (const city of cities) this.load(city);
    }
    destroy() { for (const p of this.pending.values()) p.controller.abort(); this.pending.clear(); }
  }
  function cityConfig(city) {
    if (!city || !Number.isFinite(city.latitude) || !Number.isFinite(city.longitude) || Math.abs(city.latitude) > 90 || Math.abs(city.longitude) > 180 || !String(city.name || '').trim()) return null;
    return { name: String(city.name).slice(0, 100), region: String(city.region || '').slice(0, 100), country: String(city.country || '').slice(0, 100), latitude: city.latitude, longitude: city.longitude, timezone: validZone(city.timezone) ? city.timezone : 'UTC' };
  }
  function twitterUsername(value) {
    if (typeof value !== 'string') return '';
    let name = value.trim();
    if (/^(https?:\/\/|(?:www\.|mobile\.)?(?:x|twitter)\.com\/)/i.test(name)) {
      try {
        const url = new URL(/^https?:\/\//i.test(name) ? name : `https://${name}`);
        if (!/^(www\.|mobile\.)?(x|twitter)\.com$/i.test(url.hostname) || url.username || url.password || url.port || !/^\/@?[a-z0-9_]{1,15}\/?$/i.test(url.pathname)) return '';
        name = url.pathname.replace(/^\/@?|\/$/g, '');
      } catch { return ''; }
    } else name = name.replace(/^@/, '');
    return /^[a-z0-9_]{1,15}$/i.test(name) && !/^(home|explore|search|settings|messages|notifications|i|intent|share)$/i.test(name) ? name : '';
  }
  const twitterIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-5-7.6L5.2 22H2l7.4-8.6L1.8 2h6.4l4.5 6.9L18.9 2Zm-1.1 18h1.8L7.2 3.9H5.3L17.8 20Z"/></svg>';
  const fxTwitter = root.FxTwitterKit || (typeof require === 'function' ? require('./twitter.js') : null);
  const renderTwitter = (widget, container) => fxTwitter.render(widget, container);
  const cleanupTwitter = card => fxTwitter.cleanup(card);
  const retryTwitter = widget => fxTwitter.retry(widget);
  function twitterSettings(c) {
    return `<label>X 用户名或主页链接<input name="username" autocomplete="off" spellcheck="false" maxlength="200" placeholder="例如 @X 或 https://x.com/X" value="${escape(c.username)}" aria-describedby="twitterSettingsHint"></label><p id="twitterSettingsHint" class="twitter-settings-hint">显示返回列表中该账号最新发布的一条动态，不含转发和回复。默认显示中文译文，可切换原文。每次打开页面重新读取，可手动刷新。</p>`;
  }
  const registry = {
    clock: {
      name: '时钟', description: '把世界各地的时间，放在手边',
      defaults: () => ({ timezone: localZone(), style: 'digital', hour12: false, seconds: true }),
      normalize: c => ({ timezone: validZone(c.timezone) ? c.timezone : localZone(), style: c.style === 'analog' ? 'analog' : 'digital', hour12: c.hour12 === true, seconds: c.seconds !== false }),
      render: renderClock, settings: clockSettings, cleanup() {},
    },
    weather: {
      name: '天气', description: '此刻晴雨，和接下来几天的计划',
      defaults: () => ({ city: null }), normalize: c => ({ city: cityConfig(c.city) }),
      render: renderWeather, settings: weatherSettings, cleanup() {},
    },
    twitter: {
      name: 'X / 推特', description: '关注的人，一条动态就在手边',
      defaults: () => ({ username: '' }), normalize: c => ({ username: twitterUsername(c.username) }),
      render: renderTwitter, settings: twitterSettings, cleanup: cleanupTwitter,
    },
  };
  function renderClock(widget, container, now = new Date()) {
    const c = widget.config, p = clockParts(now, c.timezone);
    const date = new Intl.DateTimeFormat('zh-CN', { timeZone: c.timezone, month: 'long', day: 'numeric', weekday: 'short' }).format(now);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: c.timezone, hour: '2-digit', minute: '2-digit', ...(c.seconds ? { second: '2-digit' } : {}), hourCycle: c.hour12 ? 'h12' : 'h23' }).format(now);
    if (c.style === 'digital') {
      const hour = String(c.hour12 ? p.hour % 12 || 12 : p.hour).padStart(2, '0');
      const minute = String(p.minute).padStart(2, '0'), second = String(p.second).padStart(2, '0');
      const offset = new Intl.DateTimeFormat('en', { timeZone: c.timezone, timeZoneName: 'longOffset' }).formatToParts(now).find(part => part.type === 'timeZoneName').value.replace('GMT', 'UTC');
      container.innerHTML = `<div class="clock-content digital"><div class="clock-digital-header"><span class="clock-city" title="${escape(c.timezone)}"><i aria-hidden="true"></i><span>${escape(zoneLabel(c.timezone))}</span></span><span class="clock-offset">${escape(offset)}</span></div><time class="clock-digital" aria-label="${escape(time)}"><span aria-hidden="true">${hour}<span class="clock-colon">:</span>${minute}</span>${c.seconds ? `<span class="clock-seconds" aria-hidden="true">${second}</span>` : ''}</time><div class="clock-digital-footer"><span class="clock-date">${escape(date.replace(/(周.)$/, ' · $1'))}</span><span class="clock-period">${p.hour < 12 ? '上午' : '下午'}</span></div></div>`;
      return;
    }
    let markup;
    if (c.style === 'analog') {
      const ticks = Array.from({ length: 12 }, (_, i) => `<path d="M60 9v${i % 3 ? 4 : 7}" transform="rotate(${i * 30} 60 60)"/>`).join('');
      markup = `<svg class="clock-face" role="img" aria-label="${escape(time)}" viewBox="0 0 120 120"><circle class="clock-dial" cx="60" cy="60" r="56"/><g class="clock-ticks">${ticks}</g><g class="clock-hands"><path d="M60 60V33" transform="rotate(${(p.hour % 12) * 30 + p.minute / 2} 60 60)"/><path class="minute-hand" d="M60 60V20" transform="rotate(${p.minute * 6 + p.second / 10} 60 60)"/>${c.seconds ? `<path class="second-hand" d="M60 69V16" transform="rotate(${p.second * 6} 60 60)"/>` : ''}</g><circle class="clock-pin" cx="60" cy="60" r="3"/></svg>`;
    }
    container.innerHTML = `<div class="clock-content ${c.style} ${c.hour12 ? 'is-hour12' : ''}"><span class="clock-zone" title="${escape(c.timezone)}">${escape(zoneLabel(c.timezone))}</span>${markup}<span class="clock-date">${escape(date.replace(/(周.)$/, ' · $1'))}${c.style === 'analog' && c.hour12 ? (p.hour < 12 ? ' · 上午' : ' · 下午') : ''}</span></div>`;
  }
  function renderWeather(widget, container, client) {
    const city = widget.config.city;
    if (!city) { container.innerHTML = '<div class="widget-empty">设置城市，查看当地天气</div>'; return; }
    const entry = client.entry(city), d = entry.data;
    if (!d) {
      container.innerHTML = `<div class="weather-heading"><span>${escape(city.name)}</span><span class="widget-eyebrow">天气</span></div><div class="widget-empty">${entry.error ? '暂时无法获取天气' : '正在获取天气…'}${entry.error ? '<button class="widget-retry" type="button">重试</button>' : ''}</div>`;
      return;
    }
    const kind = weatherKind(d.current.weather_code)[0];
    const n = value => Number.isFinite(value) ? Math.round(value) : '—';
    const forecast = d.daily.time.slice(1, 5).map((day, i) => `<div><span>${escape(new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z')))}</span>${weatherIcon(d.daily.weather_code[i + 1])}<span>${n(d.daily.temperature_2m_max[i + 1])}° <em>${n(d.daily.temperature_2m_min[i + 1])}°</em></span></div>`).join('');
    const stale = entry.error || Date.now() - entry.updatedAt > WEATHER_TTL;
    const updated = new Intl.DateTimeFormat('zh-CN', { timeZone: city.timezone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(entry.updatedAt));
    container.innerHTML = `<div class="weather-heading"><span title="${escape([city.name, city.region, city.country].filter(Boolean).join(' · '))}">${escape(city.name)}</span><span class="widget-eyebrow">${escape(d.current.time.slice(5, 10).replace('-', '/'))}</span></div>
      <div class="weather-current">${weatherIcon(d.current.weather_code, d.current.is_day === 0)}<strong>${n(d.current.temperature_2m)}<small>°</small></strong><span>${kind}</span></div>
      <div class="weather-details"><span>最高 ${n(d.daily.temperature_2m_max[0])}° · 最低 ${n(d.daily.temperature_2m_min[0])}°</span><span>湿度 ${n(d.current.relative_humidity_2m)}% · 风速 ${n(d.current.wind_speed_10m)} km/h</span></div>
      <div class="weather-forecast">${forecast}</div>
      <div class="weather-source ${stale ? 'is-stale' : ''}"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a><span title="当地时间 ${escape(updated)} 更新${entry.error ? '，更新暂时失败' : entry.loading ? '，正在更新' : ''}">${escape(updated)} 更新</span>${stale ? '<button class="widget-retry" type="button" aria-label="重新获取天气">重试</button>' : ''}</div>`;
  }
  function clockSettings(c) {
    return `<div class="timezone-field"><span id="widgetTimezoneLabel">时区</span><input type="hidden" name="timezone" value="${escape(c.timezone)}"><button id="widgetTimezoneTrigger" class="timezone-trigger" type="button" aria-labelledby="widgetTimezoneLabel widgetTimezoneValue" aria-expanded="false" aria-controls="widgetTimezonePanel"><span id="widgetTimezoneValue">${escape(zoneLabel(c.timezone))}<small>${escape(c.timezone)}</small></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg></button>
      <div class="timezone-panel" id="widgetTimezonePanel" hidden><input id="widgetTimezoneSearch" type="search" role="combobox" aria-label="搜索时区" aria-autocomplete="list" aria-expanded="false" aria-controls="widgetTimezoneList" autocomplete="off" placeholder="搜索城市、时区或 UTC 偏移"><div id="widgetTimezoneList" role="listbox" aria-label="可用时区"></div><p id="widgetTimezoneCount" role="status"></p></div></div>
      <label>显示样式<select name="style"><option value="digital" ${c.style === 'digital' ? 'selected' : ''}>数字式</option><option value="analog" ${c.style === 'analog' ? 'selected' : ''}>指针式</option></select></label>
      <label>时间格式<select name="hour12"><option value="false" ${!c.hour12 ? 'selected' : ''}>24 小时制</option><option value="true" ${c.hour12 ? 'selected' : ''}>12 小时制</option></select></label>
      <label class="widget-check"><input name="seconds" type="checkbox" ${c.seconds ? 'checked' : ''}>显示秒</label>`;
  }
  function weatherSettings(c) {
    return `<label>城市<div class="city-search-row"><input id="widgetCityQuery" autocomplete="off" placeholder="输入城市，如：北京 / London" value="${escape(c.city?.name || '')}"><button class="secondary-button" id="widgetCitySearch" type="button">搜索</button></div></label>
      <p class="widget-city-selected" id="widgetCitySelected">${c.city ? `已选择：${escape([c.city.name, c.city.region, c.city.country].filter(Boolean).join(' · '))}` : '请选择要显示天气的城市'}</p><div id="widgetCityResults" class="widget-city-results" aria-live="polite"></div>`;
  }
  function create(options) {
    const { getData, saveWidgets, notify } = options;
    const doc = root.document;
    const layer = doc.createElement('section');
    layer.className = 'widget-layer'; layer.setAttribute('aria-label', '我的组件'); doc.body.append(layer);
    const preview = doc.createElement('div'); preview.className = 'widget-placement-preview'; preview.hidden = true; layer.append(preview);
    const dialog = doc.createElement('dialog'); dialog.className = 'widget-dialog'; dialog.setAttribute('aria-labelledby', 'widgetDialogTitle'); doc.body.append(dialog);
    const abort = new AbortController(), signal = abort.signal;
    const cards = new Map(), positions = new Map();
    let editing = false, drag = null, modalDraft = null, citySearch = null, busy = false, scheduled = 0, scrollFrame = 0, signature = '', returnFocus = null;
    let queue = Promise.resolve();
    const client = new WeatherClient({ onChange: () => paintWeather() });
    const isDesktop = () => root.innerWidth > 680;
    const widgets = () => getData().widgets || [];
    const current = id => widgets().find(w => w.id === id);
    function mutate(change) {
      const run = async () => {
        busy = true; layer.classList.add('is-saving');
        try { await saveWidgets(change(clone(widgets()))); return true; }
        catch (error) { console.warn('Widget save failed', error); notify('组件保存失败，请重试。'); render(editing); return false; }
        finally { busy = false; layer.classList.remove('is-saving'); schedule(); }
      };
      const result = queue.then(run); queue = result.catch(() => {}); return result;
    }
    function rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + root.scrollX, y: r.top + root.scrollY, width: r.width, height: r.height };
    }
    function obstacles() {
      const list = ['.start-panel', '.brand', '.top-actions', '.edit-toolbar', '.page-footer'].map(s => doc.querySelector(s)).filter(el => el && !el.hidden && getComputedStyle(el).visibility !== 'hidden').map(rectOf);
      const button = doc.querySelector('#searchSubmitButton');
      if (button) { const b = rectOf(button); list.push({ x: b.x + b.width / 2 - 8, y: b.y + b.height / 2 - 168, width: 180, height: 336 }); }
      return list;
    }
    function desiredRect(w) {
      const [width, height] = widgetSize(w);
      return { x: GAP + w.position.x * Math.max(0, doc.documentElement.clientWidth - width - GAP * 2), y: w.position.y, width, height };
    }
    function applyRect(el, r) { Object.assign(el.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }); }
    function layout() {
      scheduled = 0;
      if (!isDesktop()) { doc.body.style.minHeight = ''; return; }
      const blocked = obstacles(); positions.clear();
      let bottom = doc.querySelector('.page-shell').offsetHeight;
      for (const w of widgets()) {
        const r = placeRect(desiredRect(w), blocked, doc.documentElement.clientWidth);
        positions.set(w.id, r); blocked.push(r); bottom = Math.max(bottom, r.y + r.height + 112);
        if (cards.has(w.id) && drag?.id !== w.id) applyRect(cards.get(w.id), r);
      }
      doc.body.style.minHeight = widgets().length ? `${bottom}px` : '';
    }
    function schedule() { if (!scheduled) scheduled = root.requestAnimationFrame(layout); }
    function paintWeather() {
      if (!isDesktop()) return;
      for (const w of widgets()) if (w.type === 'weather' && cards.has(w.id)) registry.weather.render(w, cards.get(w.id).querySelector('.widget-content'), client);
    }
    function refreshWeather() {
      client.sync(isDesktop() && !doc.hidden ? widgets().filter(w => w.type === 'weather' && w.config.city).map(w => w.config.city) : []);
      paintWeather();
    }
    function tick() {
      if (!isDesktop() || doc.hidden) return;
      const now = new Date();
      for (const w of widgets()) if (w.type === 'clock' && cards.has(w.id)) registry.clock.render(w, cards.get(w.id).querySelector('.widget-content'), now);
    }
    function refreshTwitter() {
      for (const w of widgets()) if (w.type === 'twitter' && cards.has(w.id)) {
        const card = cards.get(w.id);
        if (!isDesktop()) registry.twitter.cleanup(card);
        else if (!doc.hidden) registry.twitter.render(w, card.querySelector('.widget-content'));
      }
    }
    function render(nextEditing) {
      editing = nextEditing;
      if (!editing) { cancelDrag(); closeDialog(); }
      layer.classList.toggle('is-editing', editing);
      const next = JSON.stringify(widgets());
      if (next !== signature) {
        signature = next;
        for (const [id, card] of cards) {
          const w = current(id);
          if (w && card.dataset.signature === JSON.stringify([w.type, w.size, w.config])) continue;
          registry[card.dataset.type].cleanup(card); card.remove(); cards.delete(id);
        }
        for (const w of widgets()) {
          if (cards.has(w.id)) continue;
          const card = doc.createElement('article'); card.className = `desktop-widget widget-${w.type} widget-size-${w.size}`;
          card.dataset.widgetId = w.id; card.dataset.type = w.type;
          card.dataset.signature = JSON.stringify([w.type, w.size, w.config]);
          card.setAttribute('aria-label', `${registry[w.type].name}组件`);
          card.tabIndex = 0;
          card.setAttribute('aria-description', '拖动顶部或空白区域移动；聚焦组件后可用方向键微调，Enter 保存，Esc 取消。');
          card.innerHTML = `<div class="widget-controls"><div><button data-action="settings" type="button" aria-label="配置组件" title="配置">⚙</button><button data-action="copy" type="button" aria-label="复制组件" title="复制">⧉</button><button data-action="delete" type="button" aria-label="删除组件" title="删除">×</button></div></div><div class="widget-content"></div>`;
          layer.append(card); cards.set(w.id, card);
        }
        tick(); refreshWeather();
      }
      refreshTwitter(); schedule();
    }
    function resolvedPosition(id) {
      const r = positions.get(id);
      if (!r) return current(id)?.position || { x: 0, y: 104 };
      return positionFromRect(r);
    }
    function positionFromRect(r) { return { x: clamp((r.x - GAP) / Math.max(1, doc.documentElement.clientWidth - r.width - GAP * 2), 0, 1), y: r.y }; }
    function startDrag(id, x, y, keyboard = false) {
      if (busy || !isDesktop() || drag || !positions.has(id)) return;
      const r = positions.get(id);
      drag = { id, original: { ...r }, candidate: { ...r }, x, y, keyboard };
      cards.get(id).classList.add('is-dragging'); preview.hidden = false; applyRect(preview, r);
    }
    function updateDrag(x, y) {
      if (!drag) return;
      const raw = { ...drag.original, x: drag.original.x + x - drag.x, y: drag.original.y + y - drag.y };
      const blocked = [...obstacles(), ...[...positions].filter(([id]) => id !== drag.id).map(([, r]) => r)];
      drag.candidate = placeRect(raw, blocked, doc.documentElement.clientWidth);
      applyRect(cards.get(drag.id), { ...raw, x: clamp(raw.x, GAP, doc.documentElement.clientWidth - raw.width - GAP), y: Math.max(96, raw.y) });
      applyRect(preview, drag.candidate);
      doc.body.style.minHeight = `${Math.max(doc.querySelector('.page-shell').offsetHeight, ...[...positions.values()].map(r => r.y + r.height + 112), raw.y + raw.height + 112, drag.candidate.y + raw.height + 112)}px`;
    }
    function autoScroll() {
      if (!drag || drag.keyboard) { scrollFrame = 0; return; }
      const y = drag.clientY;
      const speed = y < 64 ? -Math.ceil((64 - y) / 4) : y > root.innerHeight - 64 ? Math.ceil((y - root.innerHeight + 64) / 4) : 0;
      if (speed) { root.scrollBy(0, speed); updateDrag(drag.clientX + root.scrollX, drag.clientY + root.scrollY); }
      scrollFrame = root.requestAnimationFrame(autoScroll);
    }
    function cancelDrag() {
      if (!drag) return;
      const card = cards.get(drag.id);
      if (card) { card.classList.remove('is-dragging'); applyRect(card, drag.original); }
      drag = null; preview.hidden = true;
      root.cancelAnimationFrame(scrollFrame); scrollFrame = 0; schedule();
    }
    async function finishDrag() {
      if (!drag) return;
      const { id, candidate } = drag; cancelDrag();
      await mutate(list => list.map(w => w.id === id ? { ...w, position: positionFromRect(candidate) } : w));
      cards.get(id)?.focus({ preventScroll: true });
    }
    layer.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('a, button, input, select, textarea, video, audio, [contenteditable], .twitter-scroll')) return;
      const card = event.target.closest('[data-widget-id]'); if (!card) return;
      const id = card.dataset.widgetId;
      startDrag(id, event.pageX, event.pageY); if (!drag) return;
      drag.clientX = event.clientX; drag.clientY = event.clientY;
      scrollFrame = root.requestAnimationFrame(autoScroll);
      event.preventDefault(); card.focus({ preventScroll: true }); card.setPointerCapture(event.pointerId);
    }, { signal });
    layer.addEventListener('pointermove', event => { if (drag && !drag.keyboard) { drag.clientX = event.clientX; drag.clientY = event.clientY; updateDrag(event.pageX, event.pageY); } }, { signal });
    layer.addEventListener('pointerup', () => { if (drag && !drag.keyboard) finishDrag(); }, { signal });
    layer.addEventListener('pointercancel', cancelDrag, { signal });
    layer.addEventListener('lostpointercapture', () => { if (drag && !drag.keyboard) cancelDrag(); }, { signal });
    layer.addEventListener('keydown', event => {
      if (!event.target.matches('[data-widget-id]')) return;
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (moves[event.key]) {
        event.preventDefault();
        if (!drag) startDrag(event.target.closest('[data-widget-id]').dataset.widgetId, 0, 0, true);
        if (!drag) return;
        const [dx, dy] = moves[event.key], step = event.shiftKey ? 10 : 1;
        drag.x -= dx * step; drag.y -= dy * step; updateDrag(0, 0);
      } else if (event.key === 'Enter' && drag) { event.preventDefault(); finishDrag(); }
    }, { signal });
    layer.addEventListener('focusout', event => { if (drag?.keyboard && !event.target.contains(event.relatedTarget)) finishDrag(); }, { signal });
    doc.addEventListener('keydown', event => {
      if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopImmediatePropagation(); cancelDrag(); }
    }, { capture: true, signal });
    root.addEventListener('blur', cancelDrag, { signal });
    layer.addEventListener('click', async event => {
      const card = event.target.closest('[data-widget-id]'); if (!card) return;
      const w = current(card.dataset.widgetId); if (!w) return;
      if (w.type === 'twitter' && event.target.closest('button.twitter-refresh')) {
        retryTwitter(w);
        return;
      }
      if (w.type === 'twitter' && event.target.closest('button.twitter-translation-toggle')) {
        fxTwitter.toggleTranslation(card);
        return;
      }
      if (event.target.closest('.widget-retry')) { if (w.config.city) { client.load(w.config.city, true); paintWeather(); } return; }
      if (!editing || busy) return;
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'settings') openSettings(clone(w));
      if (action === 'copy') {
        const copy = { ...clone(w), id: uid(), position: resolvedPosition(w.id) };
        if (await mutate(list => [...list, copy])) notify('组件已复制。');
      }
      if (action === 'delete') {
        const saved = clone(w), index = widgets().findIndex(item => item.id === w.id);
        if (await mutate(list => list.filter(item => item.id !== w.id))) notify('组件已删除。', '撤销', async () => {
          if (await mutate(list => { if (!list.some(item => item.id === saved.id)) list.splice(Math.min(index, list.length), 0, saved); return list; })) notify('已恢复组件。');
        });
      }
    }, { signal });
    function closeDialog() {
      citySearch?.abort(); citySearch = null; modalDraft = null;
      if (dialog.open) {
        dialog.close();
        const cardId = returnFocus?.closest?.('[data-widget-id]')?.dataset.widgetId;
        const target = returnFocus?.isConnected ? returnFocus : cards.get(cardId)?.querySelector('[data-action="settings"]') || doc.querySelector('#addWidgetButton');
        target?.focus({ preventScroll: true });
      }
    }
    function dialogFrame(title, content) {
      dialog.innerHTML = `<div class="widget-dialog-heading"><div><span class="widget-eyebrow">MAKE IT YOURS</span><h2 id="widgetDialogTitle">${title}</h2></div><button class="widget-dialog-close" type="button" aria-label="关闭组件面板">×</button></div>${content}`;
      dialog.querySelector('.widget-dialog-close').addEventListener('click', closeDialog);
      if (!dialog.open) { returnFocus = doc.activeElement; dialog.showModal(); }
    }
    function openPicker() {
      if (!isDesktop() || !editing) return;
      dialogFrame('添加组件', `<p class="widget-dialog-description">为你的空间，添一点实用与个性。</p><div class="widget-picker">${Object.entries(registry).map(([type, def]) => `<button type="button" data-widget-type="${type}"><span class="widget-picker-icon">${type === 'twitter' ? twitterIcon : type === 'clock' ? '<svg viewBox="0 0 42 42" fill="none" stroke="currentColor" stroke-width="2"><circle cx="21" cy="21" r="16"/><path d="M21 10v12l8 4"/></svg>' : weatherIcon(2)}</span><strong>${def.name}</strong><span>${def.description}</span><em>添加 +</em></button>`).join('')}</div>`);
      dialog.querySelectorAll('[data-widget-type]').forEach(button => button.addEventListener('click', () => {
        const type = button.dataset.widgetType;
        openSettings({ id: uid(), type, size: 'medium', position: { x: 0, y: 104 }, config: registry[type].defaults() });
      }));
    }
    function openSettings(w) {
      cancelDrag(); citySearch?.abort(); modalDraft = w;
      const existing = !!current(w.id);
      dialogFrame(`${existing ? '配置' : '添加'}${registry[w.type].name}`, `<form class="widget-settings"><div class="widget-settings-fields">${registry[w.type].settings(w.config)}<label>组件尺寸<select name="size">${Object.entries({ small: '小', medium: '中', large: '大' }).map(([v, label]) => `<option value="${v}" ${v === w.size ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><p class="widget-form-error" role="alert"></p><div class="widget-dialog-actions"><button class="secondary-button widget-cancel" type="button">取消</button><button class="primary-button" type="submit">${existing ? '保存设置' : '添加组件'}</button></div></form>`);
      dialog.querySelector('.widget-cancel').addEventListener('click', closeDialog);
      if (w.type === 'clock') bindTimezonePicker(w.config.timezone);
      if (w.type === 'weather') {
        const query = dialog.querySelector('#widgetCityQuery');
        dialog.querySelector('#widgetCitySearch').addEventListener('click', searchCities);
        query.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchCities(); } });
        query.addEventListener('input', () => { citySearch?.abort(); citySearch = null; dialog.querySelector('#widgetCityResults').replaceChildren(); });
      }
      dialog.querySelector('form').addEventListener('submit', async event => {
        event.preventDefault(); if (busy || !modalDraft) return;
        const form = event.currentTarget, fields = new FormData(form), draft = clone(modalDraft);
        const error = form.querySelector('.widget-form-error');
        if (draft.type === 'clock') {
          const timezone = String(fields.get('timezone')).trim();
          if (!validZone(timezone)) { error.textContent = '请选择有效的 IANA 时区，例如 Asia/Shanghai。'; return; }
          draft.config = { timezone, style: fields.get('style'), hour12: fields.get('hour12') === 'true', seconds: fields.has('seconds') };
        } else if (draft.type === 'twitter') {
          const username = twitterUsername(fields.get('username'));
          if (!username) { error.textContent = '请输入有效的用户名（1–15 位字母、数字或下划线），或 X / Twitter 主页链接。'; return; }
          draft.config = { username };
        } else if (draft.type === 'weather' && !draft.config.city) { error.textContent = '请先搜索并选择城市。'; return; }
        draft.size = fields.get('size');
        form.querySelector('[type="submit"]').disabled = true;
        const ok = await mutate(list => { const index = list.findIndex(item => item.id === draft.id); if (index < 0) list.push(draft); else list[index] = draft; return list; });
        if (ok) { closeDialog(); notify(existing ? '组件设置已保存。' : '组件已添加，可拖动调整位置。'); }
        else { error.textContent = '保存失败，请重试。'; form.querySelector('[type="submit"]').disabled = false; }
      });
    }
    function bindTimezonePicker(selected) {
      const options = timezoneOptions(selected);
      const trigger = dialog.querySelector('#widgetTimezoneTrigger'), panel = dialog.querySelector('#widgetTimezonePanel');
      const search = dialog.querySelector('#widgetTimezoneSearch'), list = dialog.querySelector('#widgetTimezoneList');
      const field = dialog.querySelector('[name="timezone"]'), value = dialog.querySelector('#widgetTimezoneValue');
      let matches = options, active = 0;
      const dismiss = () => close();
      const dismissOutside = event => { if (!trigger.parentElement.contains(event.target)) close(); };
      function close(restore = false) {
        panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); search.setAttribute('aria-expanded', 'false'); search.removeAttribute('aria-activedescendant');
        dialog.removeEventListener('scroll', dismiss); dialog.removeEventListener('close', dismiss); dialog.removeEventListener('pointerdown', dismissOutside); root.removeEventListener('resize', dismiss);
        if (restore) trigger.focus();
      }
      function highlight() {
        [...list.children].forEach((el, i) => el.classList.toggle('is-highlighted', i === active));
        if (matches[active]) {
          search.setAttribute('aria-activedescendant', `timezone-option-${active}`);
          const option = list.children[active], top = option.offsetTop - list.offsetTop;
          if (top < list.scrollTop) list.scrollTop = top;
          else if (top + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + option.offsetHeight - list.clientHeight;
        }
        else search.removeAttribute('aria-activedescendant');
      }
      function choose(index) {
        const option = matches[index]; if (!option) return;
        field.value = option.zone;
        value.innerHTML = `${escape(option.label)}<small>${escape(option.zone)}</small>`;
        close(true);
      }
      function paint() {
        matches = filterTimezones(options, search.value);
        active = Math.max(0, matches.findIndex(o => o.zone === field.value));
        list.innerHTML = matches.map((option, i) => `<button type="button" role="option" id="timezone-option-${i}" aria-selected="${option.zone === field.value}" tabindex="-1"><span><strong>${escape(option.label)}</strong><small>${escape(option.zone)}</small></span><em>${escape(option.offset)}</em></button>`).join('');
        [...list.children].forEach((el, i) => el.addEventListener('click', () => choose(i)));
        dialog.querySelector('#widgetTimezoneCount').textContent = matches.length ? `${matches.length} 个时区 · ↑ ↓ 选择，Enter 确认` : '没有匹配的时区，试试“北京”“纽约”或 Europe/London';
        highlight();
      }
      function open() {
        const rect = trigger.getBoundingClientRect(), below = root.innerHeight - rect.bottom - 16, above = rect.top - 16;
        const downward = below >= 240 || below >= above;
        const height = Math.min(300, Math.max(120, downward ? below : above));
        Object.assign(panel.style, { left: `${rect.left}px`, top: `${downward ? rect.bottom + 6 : Math.max(8, rect.top - height - 6)}px`, width: `${rect.width}px`, height: `${height}px` });
        panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); search.setAttribute('aria-expanded', 'true'); search.value = ''; paint(); search.focus({ preventScroll: true });
        dialog.addEventListener('scroll', dismiss); dialog.addEventListener('close', dismiss); dialog.addEventListener('pointerdown', dismissOutside); root.addEventListener('resize', dismiss);
      }
      trigger.addEventListener('click', () => panel.hidden ? open() : close());
      trigger.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); open(); } });
      search.addEventListener('input', paint);
      panel.addEventListener('keydown', e => {
        if (e.isComposing) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = matches.length ? (active + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length : 0; highlight(); }
        if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      });
      panel.parentElement.addEventListener('focusout', e => { if (!panel.parentElement.contains(e.relatedTarget)) close(); });
    }
    async function searchCities() {
      citySearch?.abort();
      const controller = new AbortController(); citySearch = controller;
      const draft = modalDraft, query = dialog.querySelector('#widgetCityQuery').value.trim(), results = dialog.querySelector('#widgetCityResults');
      if (query.length < 2) { results.textContent = '请输入至少两个字符。'; return; }
      results.textContent = '正在搜索城市…';
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await root.fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: '8', language: 'zh', format: 'json' })}`, { signal: controller.signal });
        if (!response.ok) throw new Error('city search unavailable');
        const data = await response.json();
        if (controller !== citySearch || draft !== modalDraft) return;
        const cities = (data.results || []).map(city => cityConfig({ ...city, region: city.admin1 })).filter(Boolean);
        results.replaceChildren();
        if (!cities.length) results.textContent = '没有找到城市，可尝试英文名称。';
        for (const city of cities) {
          const button = doc.createElement('button'); button.type = 'button';
          button.textContent = [city.name, city.region, city.country].filter(Boolean).join(' · ');
          button.addEventListener('click', () => {
            if (draft !== modalDraft) return;
            draft.config.city = city;
            dialog.querySelector('#widgetCitySelected').textContent = `已选择：${button.textContent}`;
            dialog.querySelector('.widget-form-error').textContent = '';
            results.replaceChildren();
          }); results.append(button);
        }
      } catch { if (citySearch === controller && modalDraft === draft) results.textContent = '城市搜索失败，请重试。'; }
      finally { clearTimeout(timeout); }
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); }, { signal });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } }, { signal });
    doc.querySelector('#addWidgetButton').addEventListener('click', openPicker, { signal });
    root.addEventListener('resize', () => { cancelDrag(); if (!isDesktop()) closeDialog(); schedule(); tick(); refreshWeather(); refreshTwitter(); }, { signal });
    doc.addEventListener('visibilitychange', () => { tick(); refreshWeather(); refreshTwitter(); }, { signal });
    const observer = new ResizeObserver(schedule);
    ['.start-panel', '.page-shell', '.edit-toolbar'].forEach(s => { const el = doc.querySelector(s); if (el) observer.observe(el); });
    const clockTimer = root.setInterval(tick, 1000), weatherTimer = root.setInterval(refreshWeather, WEATHER_TTL);
    return {
      render, isInteracting: () => !!drag || dialog.open,
      destroy() { cancelDrag(); abort.abort(); observer.disconnect(); for (const card of cards.values()) registry[card.dataset.type].cleanup(card); root.clearInterval(clockTimer); root.clearInterval(weatherTimer); root.cancelAnimationFrame(scheduled); client.destroy(); layer.remove(); dialog.remove(); doc.body.style.minHeight = ''; },
    };
  }
  const api = { create, normalize, placeRect, overlaps, clockParts, timezoneOptions, filterTimezones, weatherKind, validWeather, WeatherClient, twitterUsername, retryTwitter, registry, SIZES, widgetSize };
  root.WidgetKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
