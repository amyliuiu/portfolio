/* Homepage pixel arrival and shared footer timing primitives.
   Homepage playback is uniformly stretched to 1.5s; exported base math remains
   at 1.2s for the reversed footer arrival.
   Top-to-bottom pixel arrival. Density builds; opacity does not.
   Every original stitch appears once, at full color and its final coordinates.
   Arrival times have a fixed spatial stagger, independent of the static dropout
   pattern, so a softly scattered leading edge travels down the existing plaid.
   No movement, scaling, alpha tween, idle loop, or changes to C1/C2.
*/
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const DURATION = 1200, TRAVEL = 650, SCATTER = 450;
  const PLAYBACK_DURATION = 1500;
  function arrivalAt(col, row, fadeEnd, cell = 2) {
    // Different seed/constants from static density dropout: existing sparse
    // stitches should not all inherit an early arrival just because they exist.
    let n = Math.imul(col + 137, 1597334677) ^ Math.imul(row + 91, 3812015801);
    n = Math.imul(n ^ (n >>> 16), 2246822519);
    n = Math.imul(n ^ (n >>> 13), 3266489917);
    const rank = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    return 30 + TRAVEL * (row * cell / fadeEnd) + SCATTER * rank;
  }
  const element = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function create({field, landing, sampleCell, control, onFinish = () => {}}) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const replay = null; // Home replay reloads the page; no second concurrent controller.
    let geometry = null, stitches = [], palette = [], next = 0;
    let canvas = null, context = null, mask = null;
    let raf = 0, started = 0, played = false, count = 0;
    let paused = false, visible = true, disposed = false;
    const allowed = () => geometry && !paused && !reduced.matches && !document.hidden && visible;
    const state = value => {field.dataset.motionState = value;};
    function removeSurface() {
      field.querySelector('[data-static-plaid]')?.removeAttribute('mask');
      mask?.remove();canvas?.remove();canvas = context = mask = null;
    }
    function reset() {cancelAnimationFrame(raf);raf = started = next = 0;removeSurface();}
    function syncControls() {
      control.disabled = reduced.matches;
      control.setAttribute('aria-pressed', String(!paused && !reduced.matches));
      control.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Motion off' : 'Motion on';
      control.title = 'Toggle pixel arrival; use Replay entrance to watch it again';
      if (replay) replay.disabled = !allowed();
      state(reduced.matches ? 'reduced' : paused ? 'paused' : !allowed() ? 'suspended' : 'idle');
    }
    function buildCache() {
      const {width, fadeEnd, cell} = geometry;
      stitches = [];
      for (let row = 0; row * cell < fadeEnd; row++) {
        for (let col = 0; col * cell < width; col++) {
          const s = sampleCell(col, row);if (!s) continue;
          stitches.push({x: s.x, y: s.y, size: s.size, color: s.color === 'main' ? 0 : 1,
            at: arrivalAt(col, row, fadeEnd, cell)});
        }
      }
      stitches.sort((a, b) => a.at - b.at);
      const css = getComputedStyle(field);
      palette = [css.getPropertyValue('--plaid-main').trim() || '#7FCEEB', css.getPropertyValue('--plaid-accent').trim() || '#F5B4C8'];
    }
    function ensureSurface() {
      if (canvas) return true;
      canvas = document.createElement('canvas');
      canvas.className = 'fabric-motion';canvas.dataset.motion = 'pixel-arrival';canvas.setAttribute('aria-hidden', 'true');
      const dpr = Math.min(devicePixelRatio || 1, 3);
      canvas.width = Math.round(geometry.width * dpr);canvas.height = Math.round(geometry.height * dpr);
      canvas.style.width = `${geometry.width}px`;canvas.style.height = `${geometry.height}px`;
      context = canvas.getContext('2d');
      if (!context) {canvas = null;return false;}
      context.setTransform(dpr, 0, 0, dpr, 0, 0);field.after(canvas);
      mask = element('mask', {
        id: 'pixel-arrival-mask', 'data-motion': 'mask', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse',
        x: 0, y: 0, width: geometry.width, height: geometry.height, style: 'mask-type:luminance',
      });
      mask.append(element('rect', {width: geometry.width, height: geometry.height, fill: 'black'}));
      field.querySelector('defs').append(mask);
      field.querySelector('[data-static-plaid]').setAttribute('mask', 'url(#pixel-arrival-mask)');
      return true;
    }
    function draw(elapsed) {
      if (!ensureSurface()) return false;
      const paths = [new Path2D(), new Path2D()];
      // Append only new arrivals. Existing pixels never dim or disappear.
      while (next < stitches.length && stitches[next].at <= elapsed) {
        const s = stitches[next++];paths[s.color].rect(s.x, s.y, s.size, s.size);
      }
      context.globalAlpha = 1;
      for (let i = 0; i < 2; i++) {context.fillStyle = palette[i];context.fill(paths[i]);}
      canvas.dataset.shown = String(next);canvas.dataset.total = String(stitches.length);
      canvas.dataset.elapsed = elapsed.toFixed(1);
      return true;
    }
    function start() {
      if (!allowed()) return;
      reset();count++;field.dataset.entranceCount = String(count);
      // First frame contains no plaid; all text is untouched and readable.
      if (!draw(0)) {finish();return;}
      started = performance.now();state('arriving');raf = requestAnimationFrame(tick);
    }
    function tick(now) {
      raf = 0;
      if (!allowed()) {finish();return;}
      const elapsed = (now - started) * DURATION / PLAYBACK_DURATION;
      if (elapsed >= DURATION) {finish();return;}
      if (!draw(elapsed)) {finish();return;}
      raf = requestAnimationFrame(tick);
    }
    function finish() {if (disposed) return;reset();syncControls();onFinish({paused});}
    function sync() {finish();}
    function toggle() {paused = !paused;sync();}
    replay?.addEventListener('click', start);
    control.addEventListener('click', toggle);
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    const observer = new IntersectionObserver(entries => {
      const nextVisible = entries[0].isIntersecting;
      if (nextVisible !== visible) {visible = nextVisible;sync();}
    });
    observer.observe(landing);
    return {reset, destroy() {
      disposed = true;reset();observer.disconnect();
      control.removeEventListener('click', toggle);
      reduced.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    }, refresh(nextGeometry) {
      reset();geometry = nextGeometry;buildCache();syncControls();
      if (!played) {played = true;if (allowed()) start();else finish();}
    }};
  }
  window.HomePixelEntrance = Object.freeze({create, playbackDuration: PLAYBACK_DURATION, math: Object.freeze({arrivalAt, DURATION, TRAVEL, SCATTER})});
})();
