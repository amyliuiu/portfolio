/* Footer adapter of C1: mirrored pointer coordinates, unique mask, and cleanup.
   Spring integration, stripe guides, pixel drawing, and idle timing are unchanged. */
/* Flat weave opening, version 4.
   There is deliberately NO macroscopic tug, lens, or cursor-centered expansion.
   Stripe centerlines stay registered to the original plaid. Only the spacing
   of stitches WITHIN each stripe opens, by a maximum of a few pixels.

   Warp and weft use the same openness field and coordinate map. Pixels retain
   their original size. SVG remains the settled rendering/export; canvas redraws
   only the active region to keep fast cursor scanning responsive. */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const GRID = 16;
  const STIFFNESS = 530, DAMPING = 40, TENSION = 160;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const element = (tag, attrs = {}) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  // Every colored stripe gets its OWN fixed center, independent of the cursor.
  // Adjacent paper threads interpolate continuously between the stripe edges.
  // Three periods handle runs crossing a tile seam without cutting the weave.
  function threadGuide(sequence, cell, strain, limit) {
    const repeated = [...sequence, ...sequence, ...sequence];
    const values = Array(repeated.length).fill(null);
    for (let start = 0; start < repeated.length;) {
      let end = start + 1;
      while (end < repeated.length && repeated[end] === repeated[start]) end++;
      if (repeated[start] !== 'paper') {
        const center = (start + end - 1) / 2;
        for (let i = start; i < end; i++) values[i] = clamp((i - center) * cell * strain, -limit, limit);
      }
      start = end;
    }
    return Float32Array.from(sequence, (_, i) => {
      const index = i + sequence.length;
      if (values[index] !== null) return values[index];
      let left = index - 1, right = index + 1;
      while (left >= 0 && values[left] === null) left--;
      while (right < values.length && values[right] === null) right++;
      if (left < 0 || right >= values.length) return 0;
      const t = (index - left) / (right - left);
      return values[left] * (1 - t) + values[right] * t;
    });
  }

  function create({field, landing, sampleCell, control, pointerPosition}) {
    const listeners = new AbortController();
    let disposed = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let geometry = null, cache = [], guideX = [], guideY = [];
    let meshCols = 0, meshRows = 0;
    let openness = new Float32Array(0), velocity = new Float32Array(0), acceleration = new Float32Array(0);
    let xIndices = [], xWeights = [];
    let canvas = null, context = null, mask = null, hole = null, palette = [];
    let raf = 0, timer = 0, previousTime = 0;
    let paused = false, inView = true, cycle = 0, stableFrames = 0;
    let pointer = {active: false, x: 0, y: 0, strength: 1}, lastPointer = null, idle = null;
    const allowed = () => !disposed && geometry && !paused && !reduced.matches && !document.hidden && inView;
    const state = value => {field.dataset.motionState = value;};

    function removeSurface() {
      field.querySelector('[data-static-plaid]')?.removeAttribute('mask');
      mask?.remove();canvas?.remove();
      mask = hole = canvas = context = null;
    }
    function reset() {
      cancelAnimationFrame(raf);clearTimeout(timer);
      raf = timer = previousTime = stableFrames = 0;
      pointer.active = false;
      lastPointer = idle = null;
      openness.fill(0);velocity.fill(0);acceleration.fill(0);
      removeSurface();
    }
    function updateControl() {
      control.disabled = reduced.matches;
      control.setAttribute('aria-pressed', String(!paused && !reduced.matches));
      control.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Motion off' : 'Motion on';
      control.title = reduced.matches ? 'Animation is off to respect reduced motion'
        : paused ? 'Turn weave opening on' : 'Return to the static weave';
      if (!allowed()) state(reduced.matches ? 'reduced' : paused ? 'paused' : 'suspended');
    }

    function buildCache() {
      const {cell, width, fadeEnd, warp, weft} = geometry;
      const columns = width / cell;
      // Open the fine stitch pitch, not the overall plaid repeat or centerlines.
      guideX = threadGuide(warp, cell, 0.18, 2);
      guideY = threadGuide(weft, cell, 0.24, 1.25);
      cache = [];
      for (let row = 0; row * cell < fadeEnd; row++) {
        const colors = new Uint8Array(columns);
        let first = null;
        for (let col = 0; col < columns; col++) {
          const stitch = sampleCell(col, row);
          if (stitch) {first ??= stitch;colors[col] = stitch.color === 'main' ? 1 : 2;}
        }
        const my = (row * cell + cell / 2) / GRID;
        cache.push(first ? {colors, size: first.size, inset: first.y - row * cell, meshRow: Math.floor(my), fy: my % 1} : null);
      }
      meshCols = Math.ceil(width / GRID) + 1;
      meshRows = Math.ceil(fadeEnd / GRID) + 2;
      openness = new Float32Array(meshCols * meshRows);
      velocity = new Float32Array(openness.length);
      acceleration = new Float32Array(openness.length);
      xIndices = new Uint16Array(columns);xWeights = new Float32Array(columns);
      for (let col = 0; col < columns; col++) {
        const mx = (col * cell + cell / 2) / GRID;
        xIndices[col] = Math.floor(mx);xWeights[col] = mx % 1;
      }
      const css = getComputedStyle(field);
      palette = [css.getPropertyValue('--plaid-main').trim() || '#9BCBE2', css.getPropertyValue('--plaid-accent').trim() || '#EAB7C6'];
    }
    function ensureSurface() {
      if (canvas) return true;
      canvas = document.createElement('canvas');
      canvas.className = 'fabric-motion footer-motion';canvas.dataset.motion = 'footer-fabric';canvas.setAttribute('aria-hidden', 'true');
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(geometry.width * dpr);canvas.height = Math.round(geometry.height * dpr);
      canvas.style.width = `${geometry.width}px`;canvas.style.height = `${geometry.height}px`;
      context = canvas.getContext('2d');
      if (!context) {canvas = null;return false;}
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      field.after(canvas);
      mask = element('mask', {
        id: 'footer-weave-opening-mask', 'data-motion': 'mask', maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse',
        x: 0, y: 0, width: geometry.width, height: geometry.height, style: 'mask-type:luminance',
      });
      mask.append(element('rect', {width: geometry.width, height: geometry.height, fill: 'white'}));
      hole = element('rect', {fill: 'black', width: 0, height: 0});mask.append(hole);
      field.querySelector('defs').append(mask);
      field.querySelector('[data-static-plaid]').setAttribute('mask', 'url(#footer-weave-opening-mask)');
      return true;
    }
    function queueIdle(delay = 5600) {
      clearTimeout(timer);
      if (!allowed() || pointer.active || raf) return;
      state('idle');
      timer = setTimeout(() => {
        const sites = [0.34, 0.7, 0.48, 0.2, 0.8];
        idle = {x: geometry.width * sites[cycle % sites.length], y: geometry.fadeEnd * (0.64 + cycle % 3 * 0.03), start: performance.now()};
        cycle++;wake();
      }, delay);
    }
    function wake() {
      clearTimeout(timer);stableFrames = 0;
      if (!allowed() || raf) return;
      previousTime = performance.now();raf = requestAnimationFrame(tick);
    }
    function inputAt(now) {
      if (pointer.active) return pointer;
      if (!idle) return null;
      const t = now - idle.start;
      if (t >= 2000) {idle = null;return null;}
      return {...idle, strength: 0.7 * ease(0, 550, t) * (1 - ease(1150, 2000, t))};
    }
    function integrate(dt, input) {
      for (let row = 0; row < meshRows; row++) {
        for (let col = 0; col < meshCols; col++) {
          const i = row * meshCols + col;
          // This field controls openness ONLY. It never displaces the surface
          // toward/away from the pointer, which is what caused the old bulge.
          const amount = input ? input.strength
            * (1 - ease(48, 144, Math.abs(col * GRID - input.x)))
            * (1 - ease(32, 112, Math.abs(row * GRID - input.y))) : 0;
          let sum = 0, count = 0;
          if (row > 0) {sum += openness[i - meshCols];count++;}
          if (row < meshRows - 1) {sum += openness[i + meshCols];count++;}
          if (col > 0) {sum += openness[i - 1];count++;}
          if (col < meshCols - 1) {sum += openness[i + 1];count++;}
          acceleration[i] = STIFFNESS * (amount - openness[i])
            + TENSION * (sum / count - openness[i]) - DAMPING * velocity[i];
        }
      }
      let maxOpening = 0, maxVelocity = 0;
      for (let i = 0; i < openness.length; i++) {
        velocity[i] += acceleration[i] * dt;openness[i] += velocity[i] * dt;
        if (openness[i] < 0) {openness[i] = 0;velocity[i] = 0;}
        if (openness[i] > 1.15) {openness[i] = 1.15;velocity[i] = Math.min(0, velocity[i]);}
        maxOpening = Math.max(maxOpening, openness[i]);maxVelocity = Math.max(maxVelocity, Math.abs(velocity[i]));
      }
      return {maxOpening, maxVelocity};
    }
    function interpolate(index, fx, fy) {
      const upper = openness[index] * (1 - fx) + openness[index + 1] * fx;
      const lower = openness[index + meshCols] * (1 - fx) + openness[index + meshCols + 1] * fx;
      return upper * (1 - fy) + lower * fy;
    }
    // Map samples use the same guide interpolation as the stitch centers.
    // Useful for asserting that thread pitch opens while stripe anchors stay put.
    function offsetAt(x, y) {
      const mx = x / GRID, my = y / GRID;
      const amount = interpolate(Math.floor(my) * meshCols + Math.floor(mx), mx % 1, my % 1);
      const guide = (values, coordinate) => {
        const t = coordinate / geometry.cell - 0.5, i = Math.floor(t), f = t - i;
        return values[(i % values.length + values.length) % values.length] * (1 - f)
          + values[((i + 1) % values.length + values.length) % values.length] * f;
      };
      return [guide(guideX, x) * amount, guide(guideY, y) * amount];
    }
    function draw(maxOpening) {
      let minCol = meshCols, maxCol = 0, minRow = meshRows, maxRow = 0;
      for (let row = 0; row < meshRows; row++) {
        for (let col = 0; col < meshCols; col++) {
          if (openness[row * meshCols + col] < 0.002) continue;
          minCol = Math.min(minCol, col);maxCol = Math.max(maxCol, col);
          minRow = Math.min(minRow, row);maxRow = Math.max(maxRow, row);
        }
      }
      if (minCol > maxCol || !ensureSurface()) return;
      const {cell, width, height, fadeEnd} = geometry;
      const left = Math.max(0, (minCol - 1) * GRID), right = Math.min(width, (maxCol + 1) * GRID);
      const top = Math.max(0, (minRow - 1) * GRID), bottom = Math.min(fadeEnd, (maxRow + 1) * GRID);
      hole.setAttribute('x', left);hole.setAttribute('y', top);
      hole.setAttribute('width', right - left);hole.setAttribute('height', bottom - top);
      context.clearRect(0, 0, width, height);
      const paths = [new Path2D(), new Path2D()];
      let maxShift = 0;
      for (let row = top / cell; row < bottom / cell; row++) {
        const stitches = cache[row];if (!stitches) continue;
        const y = row * cell + stitches.inset, base = stitches.meshRow * meshCols;
        for (let col = left / cell; col < right / cell; col++) {
          const color = stitches.colors[col];if (!color) continue;
          const amount = interpolate(base + xIndices[col], xWeights[col], stitches.fy);
          // Fixed stripe anchors, NOT an expansion centered on the cursor.
          // Every crossing shares these coordinates, regardless of thread owner.
          const dx = guideX[col % guideX.length] * amount;
          const dy = guideY[row % guideY.length] * amount;
          maxShift = Math.max(maxShift, Math.abs(dx), Math.abs(dy));
          paths[color - 1].rect(
            clamp(col * cell + stitches.inset + dx, 0, width - stitches.size),
            clamp(y + dy, 0, geometry.textTop - 16 - stitches.size),
            stitches.size, stitches.size,
          );
        }
      }
      for (let i = 0; i < 2; i++) {context.fillStyle = palette[i];context.fill(paths[i]);}
      canvas.dataset.maxOpening = maxOpening.toFixed(3);
      canvas.dataset.maxShift = maxShift.toFixed(3);
      canvas.dataset.sourceBounds = `${left},${top},${right},${bottom}`;
      const focus = pointer.active ? pointer : idle;
      if (focus) {
        const x = clamp(focus.x, cell, width - cell), y = clamp(focus.y, cell, fadeEnd - cell), h = cell / 2;
        const ox = offsetAt(x, y);
        canvas.dataset.focusOffset = ox.map(n => n.toFixed(3)).join(',');
        canvas.dataset.threadPitch = [cell + offsetAt(x + h, y)[0] - offsetAt(x - h, y)[0],
          cell + offsetAt(x, y + h)[1] - offsetAt(x, y - h)[1]].map(n => n.toFixed(3)).join(',');
      }
    }
    function tick(now) {
      raf = 0;
      if (!allowed()) {reset();return;}
      const dt = clamp((now - previousTime) / 1000, 0.001, 0.032);previousTime = now;
      const input = inputAt(now), steps = Math.ceil(dt / 0.008);
      let result;
      for (let i = 0; i < steps; i++) result = integrate(dt / steps, input);
      if (!input && result.maxOpening < 0.002 && result.maxVelocity < 0.01) {
        openness.fill(0);velocity.fill(0);removeSurface();queueIdle(5200 + cycle % 3 * 900);return;
      }
      draw(result.maxOpening);state(input ? 'opening' : 'closing');
      stableFrames = pointer.active && result.maxVelocity < 0.006 ? stableFrames + 1 : 0;
      if (stableFrames >= 8) {state('held');return;}
      raf = requestAnimationFrame(tick);
    }
    function release() {
      if (!pointer.active) return;
      pointer.active = false;lastPointer = null;wake();
    }
    landing.addEventListener('pointermove', event => {
      if (!allowed() || !finePointer.matches || event.pointerType === 'touch') return;
      const {x, y} = pointerPosition(event);
      if (x < 0 || x > geometry.width || y < 0 || y > geometry.fadeEnd * 0.96) {release();return;}
      const now = performance.now();
      const speed = lastPointer ? Math.hypot(x - lastPointer.x, y - lastPointer.y) / Math.max(0.008, (now - lastPointer.time) / 1000) : 0;
      lastPointer = {x, y, time: now};
      pointer = {active: true, x, y, strength: 1 + clamp(speed * 0.00012, 0, 0.12)};
      idle = null;wake();
    }, {passive: true, signal: listeners.signal});
    landing.addEventListener('pointerleave', release, {signal: listeners.signal});
    function sync() {reset();updateControl();if (allowed()) queueIdle(1400);}
    control.addEventListener('click', () => {paused = !paused;sync();}, {signal: listeners.signal});
    reduced.addEventListener('change', sync, {signal: listeners.signal});
    document.addEventListener('visibilitychange', sync, {signal: listeners.signal});
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting;
      if (visible !== inView) {inView = visible;sync();}
    });observer.observe(landing);
    return {reset, destroy() {disposed = true;reset();listeners.abort();observer.disconnect();}, refresh(nextGeometry) {
      reset();geometry = nextGeometry;buildCache();updateControl();if (allowed()) queueIdle(cycle === 0 ? 1000 : 1800);
    }};
  }
  window.FooterPlaidThreads = Object.freeze({create});
})();
