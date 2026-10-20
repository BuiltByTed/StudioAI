// Opt-in QA instrumentation. Removed by Vite from ordinary production builds.
// Records only geometry; never user text, account data, or credentials.
if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  let samples: unknown[] = [];
  const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
  const sample = (event: string, source?: Event) => {
    const target = source?.target instanceof Element ? source.target : null;
    const touch = source instanceof TouchEvent ? source.touches[0] ?? source.changedTouches[0] : null;
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const scroller = document.querySelector('[data-hf-scroll-view]');
    samples.push({ time: Date.now(), event, targetElement: target ? { tag: target.tagName, id: target.id, scroll: !!target.closest('[data-hf-scroll-view]'), dock: !!target.closest('[data-hf-dock]') } : null, touch: touch ? { x: touch.clientX, y: touch.clientY, pageY: touch.pageY } : null, keyboard: root.dataset.hfKeyboard, target: root.dataset.hfKeyboardTarget,
      motion: root.dataset.hfKeyboardMotion, scrollY, viewport: { height: visualViewport?.height, top: visualViewport?.offsetTop, page: visualViewport?.pageTop, scale: visualViewport?.scale },
      probe: rect('[data-hf-safe-area-probe]'), header: rect('[data-hf-header]'), dock: rect('[data-hf-dock]'), input: rect('#chat-input'), scroll: scroller?.scrollTop,
      variables: Object.fromEntries(['--hf-keyboard-height','--hf-dock-keyboard-offset','--hf-shell-height','--hf-layout-viewport-top'].map(key => [key, css.getPropertyValue(key)])),
      active: document.activeElement?.id, activeDock: !!document.activeElement?.closest('[data-hf-dock]') });
  };
  for (const event of ['homeframe:viewport-change', 'touchstart', 'touchend', 'focusin', 'focusout']) window.addEventListener(event, (source) => sample(event, source), true);
  const flush = () => {
    if (!samples.length) return;
    const batch = samples; samples = [];
    void fetch('/__studio_trace', { method: 'POST', body: JSON.stringify(batch), keepalive: true }).catch(() => {});
  };
  setInterval(() => sample('sample'), 100);
  setInterval(flush, 1500);
  window.addEventListener('pagehide', flush);
}

export {};
