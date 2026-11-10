// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Martin Leitner-Ankerl

// Maps core addresses to screen positions and back. The fragment shader in
// renderer.js implements the same mapping; keep both in sync.

export const LAYOUT_GRID = 0;
export const LAYOUT_RING = 1;

export function computeLayout(kind, coreSize, width, height) {
  const pad = Math.max(8, Math.min(width, height) * 0.03);
  if (kind === LAYOUT_RING) {
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.max(10, Math.min(width, height) / 2 - pad);
    const r0 = R * 0.3;
    const pitch = Math.sqrt((Math.PI * (R * R - r0 * r0)) / coreSize);
    const rings = Math.max(1, Math.floor((R - r0) / pitch));
    const ringW = (R - r0) / rings;
    const perRing = Math.ceil(coreSize / rings);
    return { kind, coreSize, width, height, cx, cy, r0, R, ringW, rings, perRing, cell: ringW };
  }
  const w = width - 2 * pad;
  const h = height - 2 * pad;
  let best = { cell: 0, cols: 1, rows: coreSize };
  // Widest column count that still gives the largest square cell.
  for (let cols = 1; cols <= coreSize; cols++) {
    const rows = Math.ceil(coreSize / cols);
    const cell = Math.min(w / cols, h / rows);
    if (cell > best.cell) best = { cell, cols, rows };
    if (cols * best.cell > w * 1.5 && cols > 8) break;
  }
  const cell = Math.max(1, Math.floor(best.cell * 4) / 4);
  const ox = (width - best.cols * cell) / 2;
  const oy = (height - best.rows * cell) / 2;
  return { kind, coreSize, width, height, cols: best.cols, rows: best.rows, cell, ox, oy };
}

export function addressAt(L, x, y) {
  if (L.kind === LAYOUT_RING) {
    const dx = x - L.cx;
    const dy = y - L.cy;
    const r = Math.hypot(dx, dy);
    const ring = Math.floor((r - L.r0) / L.ringW);
    if (ring < 0 || ring >= L.rings) return -1;
    let ang = Math.atan2(dx, -dy);
    if (ang < 0) ang += 2 * Math.PI;
    const k = Math.floor((ang / (2 * Math.PI)) * L.perRing);
    const a = ring * L.perRing + k;
    return a < L.coreSize ? a : -1;
  }
  const cx = Math.floor((x - L.ox) / L.cell);
  const cy = Math.floor((y - L.oy) / L.cell);
  if (cx < 0 || cy < 0 || cx >= L.cols || cy >= L.rows) return -1;
  const a = cy * L.cols + cx;
  return a < L.coreSize ? a : -1;
}

export function cellCenter(L, addr) {
  if (L.kind === LAYOUT_RING) {
    const ring = Math.floor(addr / L.perRing);
    const k = addr % L.perRing;
    const ang = ((k + 0.5) / L.perRing) * 2 * Math.PI;
    const r = L.r0 + (ring + 0.5) * L.ringW;
    return { x: L.cx + Math.sin(ang) * r, y: L.cy - Math.cos(ang) * r };
  }
  return {
    x: L.ox + ((addr % L.cols) + 0.5) * L.cell,
    y: L.oy + (Math.floor(addr / L.cols) + 0.5) * L.cell,
  };
}
