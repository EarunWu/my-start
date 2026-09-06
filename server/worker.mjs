const UPSTREAM = 'https://www.zhihu.com/api/v4/creators/rank/hot?domain=0&period=hour';
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });

async function readJson(response) {
  if (!response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error('invalid');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256 * 1024) { await reader.cancel(); throw new Error('oversized'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

export async function handleRequest(request, env, fetcher = fetch, timeoutMs = 10000) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/zhihu/hot') {
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  }
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  if (url.search) return json({ error: 'unexpected_parameters' }, 400);
  const proxyUrl = env.ZHIHU_PROXY_URL;
  if (proxyUrl && (proxyUrl !== 'https://mystart-api.pununu.com/api/zhihu/hot' || !env.ZHIHU_PROXY_KEY)) {
    return json({ error: 'proxy_not_configured' }, 503);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Only the configured HTTPS relay receives our key; visitor credentials are never forwarded.
    const headers = { Accept: 'application/json', 'User-Agent': 'MyStart/1.0 (+https://mystart.pununu.com)' };
    if (proxyUrl) headers.Authorization = `Bearer ${env.ZHIHU_PROXY_KEY}`;
    const response = await fetcher(proxyUrl || UPSTREAM, { method: 'GET', headers, redirect: 'manual', signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      let code;
      if (response.headers.get('content-type')?.includes('application/json')) {
        try { const failure = await readJson(response); code = failure?.error?.code; } catch {}
      } else { await response.body?.cancel(); }
      console.warn(JSON.stringify({ event: 'zhihu_upstream_failure', status: response.status, code, contentType: response.headers.get('content-type') }));
      return json({ error: response.status === 429 ? 'rate_limited' : response.status === 403 ? 'upstream_denied' : 'upstream_unavailable' }, response.status === 429 ? 429 : 502);
    }
    const payload = await readJson(response);
    if (!Array.isArray(payload?.data)) throw new Error('invalid');
    return json({ data: payload.data.slice(0, 100) });
  } catch (error) {
    console.warn(JSON.stringify({ event: 'zhihu_fetch_failure', name: error.name, message: error.message }));
    return json({ error: controller.signal.aborted ? 'upstream_timeout' : 'upstream_unavailable' }, controller.signal.aborted ? 504 : 502);
  } finally { clearTimeout(timer); }
}

export default { fetch: (request, env) => handleRequest(request, env) };
