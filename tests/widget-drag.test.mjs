import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(new URL('../widgets.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const frames = new Map(), nodes = [], saves = [], notices = [];
  let frameId = 0;
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
  doc.createElement = () => { const e = new Element(); nodes.push(e); return e; };
  doc.querySelector = selector => selector === '.page-shell' ? shell : selector === '#addWidgetButton' ? addButton : null;
  const ctx = createContext({ document: doc, console: { warn() {} }, Intl, URL, AbortController,
    innerWidth: 1280, innerHeight: 900, scrollX: 0, scrollY: 0,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
    setInterval() {}, clearInterval() {}, addEventListener() {}, ResizeObserver: class { observe() {} disconnect() {} },
  });
  runInContext(source, ctx);
  ctx.WidgetKit.registry.clock.render = () => {};
  let data = { widgets: [{ id: 'clock', type: 'clock', size: 'small', position: { x: 0, y: 104 }, config: {} }] };
  const controller = ctx.WidgetKit.create({ getData: () => data, notify: text => notices.push(text),
    saveWidgets: next => new Promise((resolve, reject) => saves.push({
      resolve: () => { data = { widgets: next }; controller.render(false); resolve(); }, reject,
    })),
  });
  const frame = () => { for (const [id, fn] of [...frames]) { if (frames.delete(id)) fn(); } };
  controller.render(false); frame();
  const [layer, preview, , card] = nodes;
  const pointer = (name, x = 50, y = 200) => layer.emit(name, { target: card, button: 0, pointerId: 1, pageX: x, pageY: y, clientX: x, clientY: y });
  const key = name => layer.emit('keydown', { target: card, key: name });
  return { layer, card, preview, doc, controller, frame, pointer, key, saves, notices };
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
