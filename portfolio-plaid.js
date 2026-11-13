/* Study C: a native-resolution SVG field, not an opacity overlay.
   A/B's edge sett, with an airier 112px horizontal-band repeat, opens from 2px cells into 1.5px stitches,
   then gently loses stitches into unprinted paper. */
(async () => {
  'use strict';
  await document.fonts.load('48px Henry');
  await document.fonts.ready;
  const CELL = 2;
  const REPEAT = 256; // Two 128px motifs; a longer dropout repeat avoids obvious columns.
  const mirror = bands => {
    const half = bands.flatMap(([color, count]) => Array(count).fill(color));
    return half.concat([...half].reverse());
  };
  const along = mirror([
    ['paper', 8], ['main', 8], ['paper', 2],
    ['accent', 1], ['paper', 3], ['main', 10],
  ]);
  // Double the vertical repeat from 56px to 112px by adding paper between
  // ALL horizontal bands. Blue bands stay 4px/8px thick; pink stays 2px.
  // The 128px-wide motif now has a much less compressed aspect ratio.
  const HORIZONTAL_PINK_SPACING = 112;
  const HORIZONTAL_PINK_OFFSET = 28;
  const across = mirror([
    ['paper', 6], ['main', 2], ['paper', 10], ['main', 4], ['paper', 6],
  ]);
  const smooth = (start, end, value) => {
    const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
  };
  // Stable per-cell thresholds: no random regeneration/flicker on resize.
  function threshold(x, y) {
    let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  const fmt = value => Number(value.toFixed(3));
  const field = document.querySelector('.plaid-field');
  const landing = document.querySelector('.landing');
  let pending = false;
  let previous = '';
  let geometry = null;
  let motion = null;
  let rowData = [];
  window.PortfolioWeave = {sampleCell, createSampler, getGeometry: () => geometry};

  function makeRow(rowIndex, fadeEnd) {
    const y = rowIndex * CELL, progress = y / fadeEnd;
    const opening = smooth(0.11, 0.53, progress), disappearing = smooth(0.53, 1, progress);
    const size = 2 - 0.5 * opening - 0.65 * disappearing;
    const sy = rowIndex % across.length;
    return {sy, horizontal: y % HORIZONTAL_PINK_SPACING === HORIZONTAL_PINK_OFFSET ? 'accent' : across[sy],
      size, density: 1 - disappearing, inset: (CELL - size) / 2};
  }
  // Independent fade length, but identical native lattice, palette, and dropout seed.
  function createSampler({width, fadeEnd}) {
    const rows = Array.from({length: Math.ceil(fadeEnd / CELL)}, (_, row) => makeRow(row, Math.max(CELL, fadeEnd - CELL)));
    return (col, row) => sampleCell(col, row, rows[row] || null, width);
  }

  // One source of truth for the settled SVG and the moving threads.
  // Crossings define the weave. Motion samples the same cells, then applies
  // one shared fabric displacement to both thread directions.
  function sampleCell(colIndex, rowIndex, row = rowData[rowIndex], width = geometry.width) {
    if (!row || colIndex < 0 || colIndex * CELL >= width) return null;
    const sx = colIndex % along.length;
    const phase = (Math.min(sx, along.length - 1 - sx) + Math.min(row.sy, across.length - 1 - row.sy)) % 2;
    const color = phase === 0 ? along[sx] : row.horizontal;
    if (color === 'paper' || threshold(colIndex % (REPEAT / CELL), rowIndex) >= row.density) return null;
    return {
      color, owner: phase === 0 ? 'warp' : 'weft',
      x: fmt(colIndex * CELL + row.inset), y: fmt(rowIndex * CELL + row.inset),
      size: fmt(row.size), colIndex, rowIndex,
    };
  }

  function render() {
    pending = false;
    // Whole cells at both external edges; the remaining odd CSS pixel is paper.
    const width = Math.floor(landing.clientWidth / CELL) * CELL;
    const height = Math.floor(landing.clientHeight / CELL) * CELL;
    const textTop = document.querySelector('.intro > p').getBoundingClientRect().top - landing.getBoundingClientRect().top;
    const fadeEnd = Math.max(CELL, Math.floor(Math.min(height * 0.64, textTop - 24) / CELL) * CELL);
    const signature = `${width}:${height}:${fadeEnd}`;
    if (!width || !height || signature === previous) return;
    previous = signature;
    motion?.reset();
    geometry = {
      width, height, fadeEnd, textTop, cell: CELL, repeat: REPEAT,
      warp: along,
      weft: across.map((color, index) => index * CELL % HORIZONTAL_PINK_SPACING === HORIZONTAL_PINK_OFFSET ? 'accent' : color),
    };
    rowData = [];
    const definitions = [];
    const rows = [];

    for (let y = 0; y < fadeEnd; y += CELL) {
      const rowIndex = y / CELL;
      const {inset} = rowData[rowIndex] = makeRow(rowIndex, fadeEnd);
      const paths = { main: [], accent: [] };

      for (let x = 0; x < Math.min(REPEAT, width); x += CELL) {
        const stitch = sampleCell(x / CELL, rowIndex);
        if (!stitch) continue;
        const s = stitch.size;
        paths[stitch.color].push(`M${stitch.x} ${fmt(inset)}h${s}v${s}h-${s}z`);
      }
      if (!paths.main.length && !paths.accent.length) continue;
      const id = `row-${rowIndex}`;
      definitions.push(`<pattern id="${id}" width="${REPEAT}" height="${CELL}" patternUnits="userSpaceOnUse">`);
      for (const color of ['main', 'accent']) {
        if (paths[color].length) {
          const fallback = color === 'main' ? '#7FCEEB' : '#F5B4C8';
          definitions.push(`<path fill="var(--plaid-${color}, ${fallback})" d="${paths[color].join('')}"/>`);
        }
      }
      definitions.push('</pattern>');
      rows.push(`<rect y="${y}" width="${width}" height="${CELL}" fill="url(#${id})"/>`);
    }
    field.setAttribute('width', width);
    field.setAttribute('height', height);
    field.setAttribute('viewBox', `0 0 ${width} ${height}`);
    field.innerHTML = `<defs>${definitions.join('')}</defs><g data-static-plaid>${rows.join('')}</g>`;
    motion?.refresh(geometry);
    window.dispatchEvent(new Event("plaid:rendered"));
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }
  new ResizeObserver(schedule).observe(landing);
  document.fonts.ready.then(schedule);
  render();
  motion = window.PlaidThreads.create({
    field, landing, sampleCell, control: window.PortfolioMotionControl,
  });
  motion.refresh(geometry);

})();
