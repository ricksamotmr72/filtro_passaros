// Rastreamento do rosto: suavização dos pontos, medidas 2D do rosto, modelo 3D do rosto da criança
// e pose rígida da cabeça (é o que faz a ave se comportar como uma máscara).

// ---------- Face coordinate frame ----------
// Origin between the eyes, x towards the image-right eye, y down, unit = outer eye-corner distance.
function computeFrame(pts) {
  const lE = pts[33], rE = pts[263];
  const u = Math.max(dist(lE, rE), 1);
  const roll = Math.atan2(rE.y - lE.y, rE.x - lE.x);
  const f = { cx: (lE.x + rE.x) / 2, cy: (lE.y + rE.y) / 2, u, roll, cos: Math.cos(roll), sin: Math.sin(roll) };

  // Yaw: horizontal offset of the nose tip relative to the cheek midpoint
  const lc = pts[234], rc = pts[454];
  const mid = { x: (lc.x + rc.x) / 2, y: (lc.y + rc.y) / 2 };
  const faceW = Math.max(dist(lc, rc), 1);
  const nose = toLocal(f, pts[1]), m = toLocal(f, mid);
  f.yaw = clamp(((nose.x - m.x) * u) / (faceW * 0.5) * 1.5, -1, 1);

  // Pitch: depth difference between forehead and chin (positive = looking down)
  f.faceH = Math.max(dist(pts[10], pts[152]), 1);
  f.pitch = clamp(((pts[152].z - pts[10].z) / f.faceH) * 1.5, -1, 1);
  return f;
}

function toLocal(f, p) {
  const dx = p.x - f.cx, dy = p.y - f.cy;
  return { x: (dx * f.cos + dy * f.sin) / f.u, y: (-dx * f.sin + dy * f.cos) / f.u };
}

// Adaptive smoothing: strong when still (no jitter), light when moving (no lag)
function smoothLandmarks(raw) {
  const prev = state.smoothPts;
  if (!prev || prev.length !== raw.length) {
    state.smoothPts = raw.map(p => ({ ...p }));
    return state.smoothPts;
  }
  const ref = Math.max(dist(raw[33], raw[263]), 1);
  const motion = dist(raw[1], prev[1]) / ref;
  const a = clamp(0.3 + motion * 6, 0.3, 0.9);
  for (let i = 0; i < raw.length; i++) {
    prev[i].x += (raw[i].x - prev[i].x) * a;
    prev[i].y += (raw[i].y - prev[i].y) * a;
    prev[i].z += (raw[i].z - prev[i].z) * a;
  }
  return prev;
}

// Smooth, slightly enlarged face outline (extra room on the forehead)
function buildFaceOval(pts, f, expand) {
  const c = { x: f.cx - f.sin * 0.45 * f.u, y: f.cy + f.cos * 0.45 * f.u };
  const P = FACE_OVAL.map(i => {
    const q = pts[i];
    const dx = q.x - c.x, dy = q.y - c.y;
    const ly = toLocal(f, q).y;
    const k = expand + clamp((-ly - 0.2) * 0.25, 0, 0.15);
    return [c.x + dx * k, c.y + dy * k];
  });
  return { path: smoothPath(P), P: P.map(([x, y]) => ({ x, y })) };
}


// ---------- Rigid 3D head pose (the bird behaves like a mask) ----------
// Landmarks come as { x, y } canvas pixels plus z (MediaPipe depth, same scale as x, smaller = closer).

const sub3 = (p, q) => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z });
const dot3 = (p, q) => p.x * q.x + p.y * q.y + p.z * q.z;
const norm3 = p => { const l = Math.hypot(p.x, p.y, p.z) || 1; return { x: p.x / l, y: p.y / l, z: p.z / l }; };

// Face-aligned frame straight from the landmarks: origin between the outer eye corners, X towards
// landmark 263, Y from forehead to chin, Z towards the camera, unit u = 3D eye-corner distance.
// Only used to express the face model in face units; the pose itself comes from solvePose.
function faceBasis(pts) {
  const A = pts[33], B = pts[263];
  const ex = sub3(B, A);
  const u = Math.max(Math.hypot(ex.x, ex.y, ex.z), 1);
  const X = norm3(ex);
  const v = sub3(pts[152], pts[10]), t = dot3(v, X);
  const Y = norm3({ x: v.x - X.x * t, y: v.y - X.y * t, z: v.z - X.z * t });
  let Z = { x: X.y * Y.z - X.z * Y.y, y: X.z * Y.x - X.x * Y.z, z: X.x * Y.y - X.y * Y.x };
  if (Z.z > 0) Z = { x: -Z.x, y: -Z.y, z: -Z.z };
  return { O: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: (A.z + B.z) / 2 }, X, Y, Z, u };
}

function toFace(B, p) {
  const d = sub3(p, B.O);
  return { x: dot3(d, B.X) / B.u, y: dot3(d, B.Y) / B.u, z: dot3(d, B.Z) / B.u };
}

// The face model: average face-unit position of each SHAPE landmark. Learned from the first frames,
// then refined slowly while the child's face is relaxed (mouth closed, eyes open, not turned too far).
function updateFaceModel(pts, f) {
  const B = faceBasis(pts);
  const cur = SHAPE_LANDMARKS.map(i => toFace(B, pts[i]));
  let m = state.face;
  if (!m) {
    m = state.face = { pts: cur, n: 1, version: 1, index: new Map(SHAPE_LANDMARKS.map((id, k) => [id, k])) };
    fitDome(m);
    return;
  }
  const relaxed = state.mouthSmooth < 0.03 && Math.max(state.lids[0], state.lids[1]) < 0.2 && Math.abs(f.yaw) < 0.35;
  if (m.n < 30) {
    // Warm-up: plain running average of the first 30 frames
    m.n++;
    const a = 1 / m.n;
    m.pts.forEach((p, k) => { p.x += (cur[k].x - p.x) * a; p.y += (cur[k].y - p.y) * a; p.z += (cur[k].z - p.z) * a; });
    m.version++;
    fitDome(m);
  } else if (relaxed) {
    m.pts.forEach((p, k) => { p.x += (cur[k].x - p.x) * 0.01; p.y += (cur[k].y - p.y) * 0.01; p.z += (cur[k].z - p.z) * 0.01; });
    if (++m.n % 20 === 0) { m.version++; fitDome(m); }
  }
}

// Least-squares head-shaped dome z = a - b * r2 through the model, used beyond the face outline
// (crest, neck, sides) so the mask keeps wrapping back smoothly where there are no landmarks.
const domeR2 = (x, y) => Math.min((x / 0.95) ** 2 + ((y - 0.35) / 1.35) ** 2, 2.2);
function fitDome(m) {
  let n = 0, sr = 0, sz = 0, srr = 0, srz = 0;
  m.pts.forEach(p => { const r = domeR2(p.x, p.y); n++; sr += r; sz += p.z; srr += r * r; srz += r * p.z; });
  const b = -(n * srz - sr * sz) / (n * srr - sr * sr || 1);
  m.dome = { a: (sz + b * sr) / n, b: clamp(b, 0.2, 1.2) };
}

// Depth (face units, towards the camera) of the mask surface at a face-unit point: the child's own
// relief inside the face, blending into the fitted dome outside it, with a small gap so the mask
// rests on the skin instead of cutting into it.
function surfaceZ(lx, ly) {
  const m = state.face;
  if (!m) return 0.55 * (1 - domeR2(lx, ly)) - 0.3;
  const dome = m.dome.a - m.dome.b * domeR2(lx, ly);
  let ws = 0, zs = 0;
  const k = 1 / (2 * 0.16 * 0.16);
  for (const p of m.pts) {
    const w = Math.exp(-((lx - p.x) ** 2 + (ly - p.y) ** 2) * k);
    ws += w; zs += w * p.z;
  }
  const cover = clamp(ws / 1.2, 0, 1);
  return (ws > 1e-6 ? cover * (zs / ws) : 0) + (1 - cover) * dome + 0.04;
}

// Rigid fit (Kabsch with uniform scale) of the face model onto the current landmarks, using only the
// rigid points. Turning, nodding or tilting the head only changes this rotation, so the mask never
// distorts. Model z is flipped to MediaPipe's convention (z away from the camera) to keep a proper rotation.
function solvePose(pts) {
  const m = state.face;
  const src = [], dst = [];
  for (const id of RIGID_LANDMARKS) {
    const p = m.pts[m.index.get(id)];
    src.push({ x: p.x, y: p.y, z: -p.z });
    dst.push(pts[id]);
  }
  const n = src.length;
  const cs = { x: 0, y: 0, z: 0 }, cd = { x: 0, y: 0, z: 0 };
  src.forEach((p, i) => { cs.x += p.x / n; cs.y += p.y / n; cs.z += p.z / n; cd.x += dst[i].x / n; cd.y += dst[i].y / n; cd.z += dst[i].z / n; });
  const H = new Array(9).fill(0);
  let ss = 0;
  src.forEach((p, i) => {
    const a = sub3(dst[i], cd), b = sub3(p, cs);
    H[0] += a.x * b.x; H[1] += a.x * b.y; H[2] += a.x * b.z;
    H[3] += a.y * b.x; H[4] += a.y * b.y; H[5] += a.y * b.z;
    H[6] += a.z * b.x; H[7] += a.z * b.y; H[8] += a.z * b.z;
    ss += dot3(b, b);
  });
  const R = mat3.orthonormalize(H);
  let sc = 0;
  src.forEach((p, i) => { sc += dot3(sub3(dst[i], cd), mat3.apply(R, sub3(p, cs))); });
  const s = sc / (ss || 1);
  const rc = mat3.apply(R, cs);
  return { R, s, t: { x: cd.x - s * rc.x, y: cd.y - s * rc.y, z: cd.z - s * rc.z } };
}

// Adaptive smoothing of the pose: steady when the head is still (no jitter), immediate when it moves.
function smoothPose(P) {
  const prev = state.pose;
  if (!prev) return (state.pose = P);
  const dR = mat3.mul(P.R, mat3.transpose(prev.R));
  const angle = Math.acos(clamp((dR[0] + dR[4] + dR[8] - 1) / 2, -1, 1));
  const move = Math.hypot(P.t.x - prev.t.x, P.t.y - prev.t.y) / Math.max(P.s, 1) + Math.abs(P.s - prev.s) / Math.max(P.s, 1);
  const a = clamp(0.3 + angle * 6 + move * 6, 0.3, 1);
  const R = mat3.orthonormalize(prev.R.map((v, k) => v + (P.R[k] - v) * a));
  state.pose = {
    R, s: prev.s + (P.s - prev.s) * a,
    t: { x: prev.t.x + (P.t.x - prev.t.x) * a, y: prev.t.y + (P.t.y - prev.t.y) * a, z: prev.t.z + (P.t.z - prev.t.z) * a }
  };
  return state.pose;
}

function trackHead(pts, f) {
  updateFaceModel(pts, f);
  return smoothPose(solvePose(pts));
}

// Face-unit point (z towards the camera) -> canvas pixels
function project(P, lx, ly, lz) {
  const v = mat3.apply(P.R, { x: lx, y: ly, z: -lz });
  return { x: P.t.x + P.s * v.x, y: P.t.y + P.s * v.y };
}

function resetTracking() {
  state.smoothPts = null;
  state.pose = null;
}
