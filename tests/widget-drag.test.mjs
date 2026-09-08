import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(new URL('../widgets.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ type = 'clock', navigation = null } = {}) {
  const frames = new Map(), nodes = [], saves = [], notices = [];
  let frameId = 0, timestamp = 0, onResize;
  class Element {
    constructor() {
      this.style = {}; this.dataset = {}; this.events = {}; this.children = []; this.hidden = false;
      const classes = new Set();
      this.classList = { add: c => classes.add(c), remove: c => classes.delete(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) };
    }
    addEventListener(name, fn) { (this.events[name] ||= []).push(fn); }
    emit(name, fields = {}) { for (const fn of this.events[name] || []) fn({ target: this, preventDefault() {}, stopImmediatePropagation() {}, ...fields }); }
    append(node) { this.children.push(node); }
    setAttribute() {}
    querySelector() { return this.content ||= new Element(); }
    closest(selector) { return selector === '[data-widget-id]' ? this : null; }
    matches(selector) { return selector === '[data-widget-id]'; }
    contains(other) { return this === other; }
    setPointerCapture() {}
    blur() { doc.activeElement = doc.body; }
    remove() {}
  }
  const shell = { offsetHeight: 800 }, addButton = new Element();
  const doc = new Element(); doc.body = new Element(); doc.documentElement = { clientWidth: 1280 }; doc.activeElement = doc.body;
  Object.defineProperty(doc.documentElement, 'scrollHeight', { get: () => Math.max(900, parseFloat(doc.body.style.minHeight) || 0) });
  doc.createElement = () => { const e = new Element(); nodes.push(e); return e; };
  doc.querySelector = selector => selector === '.page-shell' ? shell : selector === '#addWidgetButton' ? addButton : selector === '.start-panel' && navigation ? { getBoundingClientRect: () => ({ ...navigation, left: navigation.x, top: navigation.y - ctx.scrollY }) } : null;
  const ctx = createContext({ document: doc, console: { warn() {} }, Intl, URL, AbortController,
    getComputedStyle: () => ({ visibility: 'visible' }),
    innerWidth: 1280, innerHeight: 900, scrollX: 0, scrollY: 0,
    scrollBy(x, y) { ctx.scrollY = Math.max(0, Math.min(ctx.scrollY + y, doc.documentElement.scrollHeight - 900)); },
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
    setInterval() {}, clearInterval() {}, addEventListener() {}, ResizeObserver: class { constructor(fn) { onResize = fn; } observe() {} disconnect() {} },
  });
  runInContext(source, ctx);
  ctx.WidgetKit.registry.clock.render = () => {};
  ctx.WidgetKit.registry.twitter.render = () => {};
  ctx.WidgetKit.registry.twitter.cleanup = () => {};
  let data = { widgets: [{ id: 'clock', type, size: type === 'twitter' ? 'large' : 'small', position: { x: 0, y: 104 }, config: {} }] };
  const controller = ctx.WidgetKit.create({ getData: () => data, notify: text => notices.push(text),
    saveWidgets: next => new Promise((resolve, reject) => saves.push({
      resolve: () => { data = { widgets: next }; controller.render(false); resolve(); }, reject,
    })),
  });
  const frame = (elapsed = 1000 / 60) => { timestamp += elapsed; for (const [id, fn] of [...frames]) { if (frames.delete(id)) fn(timestamp); } };
  controller.render(false); frame();
  const [layer, preview, , card] = nodes;
  const pointer = (name, x = 50, y = 200) => layer.emit(name, { target: card, button: 0, pointerId: 1, pageX: x, pageY: y + ctx.scrollY, clientX: x, clientY: y });
  const key = name => layer.emit('keydown', { target: card, key: name });
  return { layer, card, preview, doc, controller, frame, pointer, key, saves, notices, ctx, resizeContent: () => onResize() };
}

test('pointer release keeps the drop position across delayed saving and re-layout without an original-position paint', async () => {
  const h = harness(); const paints = [];
  h.card.style = new Proxy(h.card.style, { set(target, key, value) { if (key === 'left') paints.push(value); target[key] = value; return true; } });
  h.pointer('pointerdown'); h.pointer('pointermove', 350);
  const drop = h.preview.style.left; assert.equal(drop, '316px');
  paints.length = 0;
  h.pointer('pointerup'); h.pointer('lostpointercapture');
  assert.equal(h.card.style.left, drop); assert.equal(h.preview.hidden, true);
  await flush(); assert.equal(h.saves.length, 1);
  h.controller.render(false); h.frame();
  assert.equal(h.card.style.left, drop);
  h.pointer('pointerdown'); h.pointer('pointermove', 500); h.pointer('pointerup');
  assert.equal(h.saves.length, 1);
  h.saves[0].resolve(); await flush(); h.frame();
  assert.equal(h.card.style.left, drop); assert.ok(paints.every(left => left === drop));
  h.controller.destroy();
});

test('failed drop stays in place while saving, then restores the last saved position and reports failure', async () => {
  const h = harness(), original = h.card.style.left;
  h.pointer('pointerdown'); h.pointer('pointermove', 350); h.pointer('pointerup');
  await flush(); h.frame(); assert.equal(h.card.style.left, '316px');
  h.saves[0].reject(new Error('disk full')); await flush(); h.frame();
  assert.equal(h.card.style.left, original); assert.match(h.notices[0], /保存失败/);
  h.controller.destroy();
});

test('Esc cancels without saving, while keyboard confirmation keeps its new position and focus', async () => {
  const h = harness(), original = h.card.style.left;
  h.doc.activeElement = h.card;
  h.key('ArrowRight'); h.doc.emit('keydown', { key: 'Escape' }); h.frame();
  assert.equal(h.card.style.left, original); assert.equal(h.saves.length, 0);
  h.key('ArrowRight'); h.key('Enter');
  assert.equal(h.card.style.left, '17px'); assert.equal(h.doc.activeElement, h.card);
  await flush(); h.frame(); assert.equal(h.card.style.left, '17px');
  h.saves[0].resolve(); await flush(); h.frame();
  assert.equal(h.card.style.left, '17px'); assert.equal(h.doc.activeElement, h.card);
  h.controller.destroy();
});

test('large X card keeps canvas height stable when dragged back across content and during observer layouts', () => {
  const h = harness({ type: 'twitter', navigation: { x: 300, y: 200, width: 680, height: 400 } });
  h.pointer('pointerdown'); h.pointer('pointermove', 600, 870);
  const expanded = parseFloat(h.doc.body.style.minHeight);
  assert.ok(expanded > 1200);
  h.pointer('pointermove', 500, 400);
  assert.equal(parseFloat(h.doc.body.style.minHeight), expanded);
  h.resizeContent(); h.frame();
  assert.equal(parseFloat(h.doc.body.style.minHeight), expanded);
  h.pointer('pointercancel'); h.controller.destroy();
});

test('edge scrolling is bounded, monotonic and stops away from the edge or after release', async () => {
  const h = harness({ type: 'twitter' });
  h.pointer('pointerdown'); h.pointer('pointermove', 500, 1200);
  let last = 0;
  for (let i = 0; i < 8; i++) {
    h.resizeContent(); h.frame();
    assert.ok(h.ctx.scrollY > last && h.ctx.scrollY - last <= 10.01);
    last = h.ctx.scrollY;
  }
  h.pointer('pointermove', 500, 400); h.frame(); assert.equal(h.ctx.scrollY, last);
  h.pointer('pointerup'); await flush(); h.saves[0].resolve(); await flush(); h.frame();
  assert.equal(h.ctx.scrollY, last);
  assert.ok(parseFloat(h.doc.body.style.minHeight) >= last + 900);
  h.frame(); assert.equal(h.ctx.scrollY, last);
  h.controller.destroy();
});
