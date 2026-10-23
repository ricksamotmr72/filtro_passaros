// Funções auxiliares: matemática, cores, caminhos suaves e matrizes 3x3.

// ---------- Math & color helpers ----------
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// amt > 0 lightens, amt < 0 darkens
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`;
}

// Closed smooth curve through a polygon (midpoint quadratic splines)
function smoothPath(points, k = 1) {
  const P = points.map(([x, y]) => ({ x: x * k, y: y * k }));
  const path = new Path2D();
  const n = P.length;
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(P[n - 1], P[0]);
  path.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const m = mid(P[i], P[(i + 1) % n]);
    path.quadraticCurveTo(P[i].x, P[i].y, m.x, m.y);
  }
  path.closePath();
  return path;
}

// ---------- 3x3 matrices (row-major arrays of 9 numbers) ----------
const mat3 = {
  mul(A, B) {
    const C = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    }
    return C;
  },
  transpose: A => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]],
  det: A => A[0] * (A[4] * A[8] - A[5] * A[7]) - A[1] * (A[3] * A[8] - A[5] * A[6]) + A[2] * (A[3] * A[7] - A[4] * A[6]),
  inverse(A) {
    const d = mat3.det(A) || 1e-12;
    return [
      (A[4] * A[8] - A[5] * A[7]) / d, (A[2] * A[7] - A[1] * A[8]) / d, (A[1] * A[5] - A[2] * A[4]) / d,
      (A[5] * A[6] - A[3] * A[8]) / d, (A[0] * A[8] - A[2] * A[6]) / d, (A[2] * A[3] - A[0] * A[5]) / d,
      (A[3] * A[7] - A[4] * A[6]) / d, (A[1] * A[6] - A[0] * A[7]) / d, (A[0] * A[4] - A[1] * A[3]) / d
    ];
  },
  // Closest rotation to A (orthogonal polar factor), by Newton iteration R <- (R + R^-T) / 2
  orthonormalize(A) {
    const n = Math.cbrt(Math.abs(mat3.det(A))) || 1;
    let R = A.map(v => v / n);
    for (let i = 0; i < 12; i++) {
      const It = mat3.transpose(mat3.inverse(R));
      R = R.map((v, k) => (v + It[k]) / 2);
    }
    return R;
  },
  apply: (A, v) => ({
    x: A[0] * v.x + A[1] * v.y + A[2] * v.z,
    y: A[3] * v.x + A[4] * v.y + A[5] * v.z,
    z: A[6] * v.x + A[7] * v.y + A[8] * v.z
  })
};
