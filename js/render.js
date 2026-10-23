// Desenho: penas ao redor do rosto, projeção da foto na máscara, pálpebras, bico articulado,
// ajuste de iluminação e partículas de penugem.

// ---------- Feather texture (grayscale tile, overlapping like real contour feathers) ----------
function buildFeatherTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 96, 96);
  const rows = 8, cols = 6, sw = 96 / cols, sh = 96 / rows;
  // Lower rows first so each row overlaps the one below it
  for (let r = rows; r >= -1; r--) {
    for (let col = -1; col <= cols; col++) {
      const x = col * sw + (r % 2 ? sw / 2 : 0), y = r * sh;
      const grad = g.createLinearGradient(x, y, x, y + sh * 1.6);
      grad.addColorStop(0, '#5c5c5c');
      grad.addColorStop(0.65, '#ababab');
      grad.addColorStop(1, '#3c3c3c');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - sw * 0.55, y);
      g.quadraticCurveTo(x - sw * 0.6, y + sh * 1.4, x, y + sh * 1.6);
      g.quadraticCurveTo(x + sw * 0.6, y + sh * 1.4, x + sw * 0.55, y);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, y + 2);
      g.lineTo(x, y + sh * 1.4);
      g.stroke();
    }
  }
  return c;
}
const featherPattern = plumageCtx.createPattern(buildFeatherTile(), 'repeat');

function featherPatternFor(f, sp) {
  // Tile feathers are 16px wide; scale them to the species' feather size and follow head roll
  const k = (sp.plumage.featherSize * f.u) / 16;
  if (featherPattern.setTransform && window.DOMMatrix) {
    featherPattern.setTransform(new DOMMatrix().translateSelf(f.cx, f.cy).rotateSelf(f.roll * 180 / Math.PI).scaleSelf(k, k));
  }
  return featherPattern;
}

// ---------- Drawing primitives ----------
function blob(g, x, y, rx, ry, rot, color, alpha = 1) {
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// A single feather pointing up (-y) before rotation, with vane, barbs and rachis
function drawFeather(ctx, x, y, angle, len, wid, c1, c2, curl = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, curl, -len);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-wid, -len * 0.2, -wid * 0.7 + curl * 0.6, -len * 0.75, curl, -len);
  ctx.bezierCurveTo(wid * 0.7 + curl * 0.6, -len * 0.75, wid, -len * 0.2, 0, 0);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = wid * 0.06;
  ctx.beginPath();
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    const rx = curl * t * t, ry = -len * t;
    const spread = wid * 0.8 * Math.sin(Math.PI * Math.min(t + 0.1, 1));
    ctx.moveTo(rx, ry); ctx.lineTo(rx - spread, ry - len * 0.07);
    ctx.moveTo(rx, ry); ctx.lineTo(rx + spread, ry - len * 0.07);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = wid * 0.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(curl * 0.3, -len * 0.5, curl, -len * 0.97);
  ctx.stroke();
  ctx.restore();
}

// ---------- Side plumage under the photo (covers hair/cheeks the photo does not reach) ----------
// Drawn in face units; colors sampled from the reference photos.
const plumageMarkings = {
  woodpecker(g) {
    blob(g, 0, -0.95, 1.0, 0.55, 0, '#d81e1e');   // red crown under the crest
    blob(g, -0.95, 0.75, 0.22, 0.6, 0.15, '#efe9dc', 0.8); // white neck stripes
    blob(g, 0.95, 0.75, 0.22, 0.6, -0.15, '#efe9dc', 0.8);
  },
  toucan(g) {
    blob(g, 0, 1.25, 0.8, 0.55, 0, '#fbf6e8');    // white bib
  },
  beijaflor(g) {
    blob(g, 0, 1.3, 0.85, 0.55, 0, '#1d4ed8');    // blue throat
  }
};

function renderPlumage(ctx, f, sp, oval) {
  const g = plumageCtx;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.filter = 'none';
  g.clearRect(0, 0, plumageCanvas.width, plumageCanvas.height);

  g.fillStyle = sp.plumage.base;
  g.fill(oval.path);

  g.save();
  g.clip(oval.path);
  g.filter = `blur(${Math.max(1, f.u * 0.04)}px)`;
  g.translate(f.cx, f.cy);
  g.rotate(f.roll);
  g.scale(f.u, f.u);
  const mark = plumageMarkings[sp.markings];
  if (mark) mark(g, f);
  g.restore();

  // Feather micro-texture
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = sp.plumage.texture;
  g.fillStyle = featherPatternFor(f, sp);
  g.fill(oval.path);

  // Soft edge so the plumage fades into the hair and neck
  g.globalCompositeOperation = 'destination-in';
  g.globalAlpha = 1;
  g.filter = `blur(${Math.max(2, f.u * 0.09)}px)`;
  g.fillStyle = '#000';
  g.fill(oval.path);
  g.restore();

  // Partial coverage, then hue from the plumage while keeping the real face lighting
  ctx.save();
  ctx.globalAlpha = state.opacity * 0.7;
  ctx.drawImage(plumageCanvas, 0, 0);
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = state.opacity * 0.9;
  ctx.drawImage(plumageCanvas, 0, 0);
  ctx.restore();
}

// Draws src onto g so that each source triangle lands on its destination triangle.
// With cull, triangles turned away from the camera are skipped (the photo is mirrored onto the
// face, so a visible triangle has the opposite winding of its source).
function drawMesh(g, src, S, D, tris, cull) {
  tris.forEach(([i, j, k]) => {
    const s0 = S[i], s1 = S[j], s2 = S[k], d0 = D[i], d1 = D[j], d2 = D[k];
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (Math.abs(den) < 1e-6) return;
    if (cull && den * ((d1.x - d0.x) * (d2.y - d0.y) - (d2.x - d0.x) * (d1.y - d0.y)) >= 0) return;
    const bx0 = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)) - 2);
    const by0 = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)) - 2);
    const bx1 = Math.min(src.width, Math.ceil(Math.max(s0.x, s1.x, s2.x)) + 2);
    const by1 = Math.min(src.height, Math.ceil(Math.max(s0.y, s1.y, s2.y)) + 2);
    if (bx1 - bx0 < 1 || by1 - by0 < 1) return;
    const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
    const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
    const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
    const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
    const e = d0.x - a * s0.x - c * s0.y, ff = d0.y - b * s0.x - d * s0.y;
    if (![a, b, c, d, e, ff].every(isFinite)) return;

    // Clip slightly enlarged so neighbouring triangles overlap and no seams show
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    const grow = p => { const l = Math.hypot(p.x - cx, p.y - cy) || 1; return { x: p.x + (p.x - cx) / l, y: p.y + (p.y - cy) / l }; };
    const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
    g.save();
    g.beginPath();
    g.moveTo(g0.x, g0.y); g.lineTo(g1.x, g1.y); g.lineTo(g2.x, g2.y);
    g.closePath();
    g.clip();
    g.setTransform(a, b, c, d, e, ff);
    g.drawImage(src, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
    g.restore();
  });
}

// Eye openness of the user: 0 open .. 1 closed, normalized by each eye's own "open" reference
function eyeClosure(pts, f, idx, i) {
  const [c1, c2, t, b] = idx;
  const ratio = dist(pts[t], pts[b]) / Math.max(dist(pts[c1], pts[c2]), 1);
  // Only learn the reference while facing the camera, slowly forgetting old values
  if (Math.abs(f.yaw) < 0.3) state.eyeRef[i] = Math.max(state.eyeRef[i] * 0.998, ratio);
  return clamp((0.72 - ratio / state.eyeRef[i]) / 0.42, 0, 1);
}

function drawLid(ctx, e, closure, colors) {
  const rx = e.rx * 1.25, ry = e.ry * 1.18;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  // Upper lid sweeps down, lower lid rises a little (like a real bird blink)
  const top = e.y - ry, lidY = top + ry * 2 * closure * 0.82;
  const bowl = ry * 0.35 * (1 - closure);
  const grad = ctx.createLinearGradient(0, top, 0, lidY + bowl);
  grad.addColorStop(0, colors[1]);
  grad.addColorStop(1, colors[0]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(e.x - rx, top - 2);
  ctx.lineTo(e.x + rx, top - 2);
  ctx.lineTo(e.x + rx, lidY);
  ctx.quadraticCurveTo(e.x, lidY + bowl * 2, e.x - rx, lidY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(2, rx * 0.08);
  ctx.beginPath();
  ctx.moveTo(e.x + rx, lidY);
  ctx.quadraticCurveTo(e.x, lidY + bowl * 2, e.x - rx, lidY);
  ctx.stroke();

  const bottom = e.y + ry, lowY = bottom - ry * 2 * closure * 0.2;
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo(e.x - rx, bottom + 2);
  ctx.lineTo(e.x + rx, bottom + 2);
  ctx.lineTo(e.x + rx, lowY);
  ctx.quadraticCurveTo(e.x, lowY - ry * 0.25 * closure, e.x - rx, lowY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Photo pixels -> face units. The canvas is shown mirrored, so the photo's left eye goes to the
// landmark-263 side (+x), which appears on the left of the screen: the bird never looks flipped.
function drawBirdHead(ctx, pts, f, sp, pose) {
  const k = sp.head.width / PHOTO;
  const s = sp.fit * state.sizeScale / sp.eyeSpan, off = state.offsetY, mid = sp.eyeMid;
  const local = q => ({ x: -(q.x - mid.x) * s, y: (q.y - mid.y) * s + off });

  // 1. Per-frame source: head photo matched to the room light, plus eyelids synced with the user's blinks
  if (frameCanvas.width !== sp.head.width || frameCanvas.height !== sp.head.height) {
    frameCanvas.width = sp.head.width;
    frameCanvas.height = sp.head.height;
  }
  const g = frameCtx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
  g.drawImage(sp.head, 0, 0);
  if (state.syncBlink) {
    g.setTransform(k, 0, 0, k, 0, 0);
    const defs = [[263, 362, 386, 374], [33, 133, 159, 145]]; // photo left eye = user's landmark-263 eye
    defs.forEach((idx, i) => {
      const target = eyeClosure(pts, f, idx, i);
      state.lids[i] += (target - state.lids[i]) * (target > state.lids[i] ? 0.7 : 0.4);
      if (state.lids[i] > 0.04) drawLid(g, sp.eyes[i], state.lids[i], sp.lid);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // 2. Head photo on the mask surface (the child's own face relief), moved by the rigid head pose.
  //    The surface only changes with the face model or the size/height sliders, so it is cached.
  const W = warpCtx;
  W.setTransform(1, 0, 0, 1, 0, 0);
  W.clearRect(0, 0, warpCanvas.width, warpCanvas.height);
  const key = (state.face ? state.face.version : 0) + '|' + s + '|' + off;
  if (sp.maskKey !== key) {
    sp.mask = sp.grid.pts.map(q => { const l = local(q); return { x: l.x, y: l.y, z: surfaceZ(l.x, l.y) }; });
    sp.maskKey = key;
  }
  const head = sp.mask.map(v => project(pose, v.x, v.y, v.z));
  drawMesh(W, frameCanvas, sp.grid.src, head, sp.grid.tris, true);

  // 3. Beak as its own 3D piece: base on the mask, tip sticking out towards the camera, so it
  //    points where the child turns. Both mandibles rotate around the jaw hinge (the mouth corners):
  //    the lower one swings down in an arc, the upper one lifts slightly, like a real bird.
  const bk = sp.beak, L = sp.beakTip - sp.beakTop;
  const baseY = (sp.beakTop - mid.y) * s + off;
  const cx = local(bk.hinge).x, hy = local(bk.hinge).y;
  const hz = surfaceZ(cx, baseY) + bk.depth * clamp((bk.hinge.y - sp.beakTop) / L, 0, 1);
  const beakPt = (q, ang, xs) => {
    const l = local(q), lx = cx + (l.x - cx) * xs;
    const t = clamp((q.y - sp.beakTop) / L, 0, 1);
    const y = l.y - hy, z = surfaceZ(lx, baseY) + bk.depth * t - hz;
    // Rotation about the hinge axis (forward turns into down). The frontal photo already shows the beak
    // foreshortened, so the swing also uses the distance below the hinge to read clearly from the front.
    // Points on the hinge line (the mouth corners) stay put.
    const c = Math.cos(ang), sn = Math.sin(ang);
    return project(pose, lx, hy + y * c + (z + Math.max(y, 0) * 1.2) * sn * 1.3, hz - y * sn * 0.5 + z * c);
  };
  const open = state.syncMouth ? state.jaw * bk.gapeMul : 0;
  const lift = -open * 0.12;
  if (open > 0.02) {
    drawMesh(W, sp.beakLower, sp.lowerGrid.src, sp.lowerGrid.pts.map(q => beakPt(q, open, 0.88)), sp.lowerGrid.tris, false);

    // Mouth cavity: the wedge between the upper beak's cutting edge and the inside of the lowered
    // mandible (inset, so the mandible's own rim stays visible around it)
    const h = bk.hinge;
    const upperEdge = sp.mouthEdge.map(q => beakPt(q, lift, 1));
    const lowerEdge = sp.mouthEdge
      .map(q => beakPt({ x: h.x + (q.x - h.x) * 0.8, y: h.y + (q.y - h.y) * 0.84 }, open, 0.88)).reverse();
    const tipU = upperEdge[Math.floor(upperEdge.length / 2)], tipL = lowerEdge[Math.floor(lowerEdge.length / 2)];
    const inner = W.createLinearGradient(tipU.x, tipU.y, tipL.x, tipL.y);
    inner.addColorStop(0, '#1a0404');
    inner.addColorStop(1, bk.gape);
    W.fillStyle = inner;
    W.beginPath();
    upperEdge.concat(lowerEdge).forEach((p, i) => (i ? W.lineTo(p.x, p.y) : W.moveTo(p.x, p.y)));
    W.closePath();
    W.fill();

    // Tongue resting on the lower mandible, slightly above it
    const tongue = sp.tongue.map(q => beakPt(q, open * 0.82, 0.88));
    const tg = W.createLinearGradient(tongue[0].x, tongue[0].y, tongue[6].x, tongue[6].y);
    tg.addColorStop(0, '#8a3a44');
    tg.addColorStop(1, '#d98a94');
    W.fillStyle = tg;
    W.globalAlpha = clamp((open - 0.02) * 6, 0, 0.9);
    W.beginPath();
    tongue.forEach((p, i) => (i ? W.lineTo(p.x, p.y) : W.moveTo(p.x, p.y)));
    W.closePath();
    W.fill();
    W.globalAlpha = 1;
  }
  drawMesh(W, sp.beakUpper, sp.beakGrid.src, sp.beakGrid.pts.map(q => beakPt(q, open > 0.02 ? lift : 0, 1)), sp.beakGrid.tris, false);

  ctx.save();
  ctx.globalAlpha = state.opacity;
  if (supportsFilter) ctx.filter = `brightness(${state.light.toFixed(3)})`;
  ctx.drawImage(warpCanvas, 0, 0);
  ctx.restore();
}

// Average scene brightness -> photo brightness, so the bird matches the room lighting
function updateLighting(img) {
  if (state.frame % 12 !== 0) return;
  try {
    lightCtx.drawImage(img, 0, 0, lightCanvas.width, lightCanvas.height);
    const px = lightCtx.getImageData(0, 0, lightCanvas.width, lightCanvas.height).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    const luma = sum / (px.length / 4) / 255;
    const target = clamp(0.5 + luma * 1.0, 0.7, 1.1);
    state.light += (target - state.light) * 0.3;
    document.getElementById('light-value').textContent = `${Math.round(state.light * 100)}%`;
  } catch (e) { /* lighting match is optional */ }
}

// ---------- Down feathers that drift and fall naturally ----------
function spawnDown(f, sp, oval) {
  if (particles.length >= 10 || Math.random() > 0.04) return;
  const upper = oval.P.filter(p => toLocal(f, p).y < 0.2);
  if (!upper.length) return;
  const p = upper[Math.floor(Math.random() * upper.length)];
  particles.push({
    x: p.x, y: p.y,
    vx: (Math.random() - 0.5) * 0.004 * f.u,
    vy: (0.002 + Math.random() * 0.004) * f.u,
    drift: f.u * 0.004,
    size: f.u * (0.07 + Math.random() * 0.07),
    color: sp.particleColors[Math.floor(Math.random() * sp.particleColors.length)],
    life: 0,
    maxLife: 160 + Math.random() * 120,
    rot: (Math.random() - 0.5) * 2,
    phase: Math.random() * Math.PI * 2
  });
}

function drawParticles(ctx) {
  const H = canvasElement.height;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life++;
    p.x += p.vx + Math.sin(p.life * 0.05 + p.phase) * p.drift;
    p.y += p.vy;
    if (p.life > p.maxLife || p.y > H + p.size) {
      particles.splice(i, 1);
      continue;
    }
    const alpha = Math.min(p.life / 20, 1, (p.maxLife - p.life) / 40) * 0.85;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawFeather(ctx, p.x, p.y, p.rot + Math.sin(p.life * 0.04 + p.phase) * 0.6,
      p.size, p.size * 0.28, p.color, shade(p.color, 0.4), p.size * 0.1);
    ctx.restore();
  }
}

