// Carregamento das fotos: junta cor + transparência, recorta o bico, preenche o fundo atrás dele
// e monta as malhas usadas para projetar a foto no rosto.

// ---------- Photo cutouts (built once per bird) ----------
// Feathered alpha mask using the shadow trick, which works in every browser (ctx.filter does not).
function cutout(img, points, feather) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  const k = img.width / PHOTO;
  const off = c.width * 3;
  g.save();
  g.shadowColor = '#000';
  g.shadowBlur = feather * k;
  g.shadowOffsetX = off;
  g.translate(-off, 0);
  g.fillStyle = '#000';
  g.fill(smoothPath(points, k));
  g.restore();
  g.globalCompositeOperation = 'source-in';
  g.drawImage(img, 0, 0);
  return c;
}

// Removes the beak from the photo and fills the hole by mirroring the feathers on each side of it,
// row by row, so the 3D beak can move over the head without revealing a second beak underneath.
function inpaint(img, poly, fillAbove) {
  const W = img.width, H = img.height, k = W / PHOTO;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, W, H), d = px.data, out = new Uint8ClampedArray(d);

  const m = document.createElement('canvas');
  m.width = W; m.height = H;
  const mg = m.getContext('2d');
  const path = smoothPath(poly, k);
  mg.fill(path);
  mg.lineWidth = 8 * k;
  mg.stroke(path);
  const hole = mg.getImageData(0, 0, W, H).data;
  const inHole = (x, y) => hole[(y * W + x) * 4 + 3] >= 8;

  // Per column: first hole row and how many opaque feather rows sit right above it
  const top = new Int32Array(W).fill(-1), band = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H && !inHole(x, y)) y++;
    if (y === H) continue;
    top[x] = y;
    let n = 0;
    while (n < 80 && y - 1 - n >= 0 && d[((y - 1 - n) * W + x) * 4 + 3] > 200) n++;
    band[x] = n;
  }
  const copy = (o, sx, sy) => { const s = (sy * W + sx) * 4; out[o] = d[s]; out[o + 1] = d[s + 1]; out[o + 2] = d[s + 2]; out[o + 3] = d[s + 3]; };

  // Wide rows (e.g. the toucan's casque spans the whole forehead) reflect the feathers above instead,
  // bouncing back and forth so the texture never runs out. Rows in between blend both fills, so there
  // is no visible seam where one method hands over to the other.
  const wideLo = W * 0.14, wideHi = W * 0.26;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!inHole(x, y)) { x++; continue; }
      const xl = x;
      while (x < W && inHole(x, y)) x++;
      const xr = x - 1, mid = (xl + xr) / 2;
      const wv = fillAbove ? clamp((xr - xl - wideLo) / (wideHi - wideLo), 0, 1) : 0;
      for (let xi = xl; xi <= xr; xi++) {
        const o = (y * W + xi) * 4;
        copy(o, clamp(xi < mid ? xl - 1 - (xi - xl) : xr + 1 + (xr - xi), 0, W - 1), y);
        if (wv > 0 && band[xi] > 6) {
          const n = band[xi], t = (y - top[xi]) % (2 * n), r = t < n ? t : 2 * n - 1 - t;
          const s = ((top[xi] - 1 - r) * W + xi) * 4;
          for (let c = 0; c < 4; c++) out[o + c] = out[o + c] * (1 - wv) + d[s + c] * wv;
        }
      }
    }
  }
  px.data.set(out);
  g.putImageData(px, 0, 0);
  return c;
}

// Color JPEG (composited over black) + grayscale alpha JPEG -> one transparent canvas
function combineAlpha(rgbImg, maskImg) {
  const W = rgbImg.width, H = rgbImg.height;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.drawImage(rgbImg, 0, 0);
  const px = g.getImageData(0, 0, W, H);
  const m = document.createElement('canvas');
  m.width = W; m.height = H;
  const mg = m.getContext('2d');
  mg.drawImage(maskImg, 0, 0, W, H);
  const a = mg.getImageData(0, 0, W, H).data, d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const al = a[i] < 6 ? 0 : a[i];
    // Undo the darkening of soft feather edges caused by compositing over black
    if (al > 16 && al < 250) {
      const f = 255 / al;
      d[i] = Math.min(255, d[i] * f); d[i + 1] = Math.min(255, d[i + 1] * f); d[i + 2] = Math.min(255, d[i + 2] * f);
    }
    d[i + 3] = al;
  }
  g.putImageData(px, 0, 0);
  return c;
}

// Regular grid over a photo region (photo pixels), keeping only cells that contain the bird
function buildGrid(src, x0, y0, x1, y1, nx, ny) {
  const N = 100, m = document.createElement('canvas');
  m.width = m.height = N;
  const mg = m.getContext('2d');
  mg.drawImage(src, 0, 0, N, N);
  const A = mg.getImageData(0, 0, N, N).data;
  const has = (ax0, ay0, ax1, ay1) => {
    const i0 = clamp(Math.floor(ax0 / PHOTO * N), 0, N - 1), i1 = clamp(Math.ceil(ax1 / PHOTO * N), 0, N - 1);
    const j0 = clamp(Math.floor(ay0 / PHOTO * N), 0, N - 1), j1 = clamp(Math.ceil(ay1 / PHOTO * N), 0, N - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (A[(j * N + i) * 4 + 3] > 8) return true;
    return false;
  };
  const k = src.width / PHOTO, pts = [], tris = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pts.push({ x: x0 + (x1 - x0) * i / nx, y: y0 + (y1 - y0) * j / ny });
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = j * (nx + 1) + i, p = pts[v], q = pts[v + nx + 2];
    if (!has(p.x, p.y, q.x, q.y)) continue;
    tris.push([v, v + 1, v + nx + 2], [v, v + nx + 2, v + nx + 1]);
  }
  return { pts, tris, src: pts.map(p => ({ x: p.x * k, y: p.y * k })) };
}

function prepareSpecies(key) {
  const sp = speciesConfig[key];
  const rgb = new Image(), mask = new Image();
  let loaded = 0;
  const onload = () => {
    if (++loaded < 2) return;
    const img = combineAlpha(rgb, mask);
    sp.head = inpaint(img, sp.beak.poly, sp.beak.fillAbove);
    sp.beakUpper = cutout(img, sp.beak.poly, 4);
    sp.beakTop = Math.min(...sp.beak.poly.map(p => p[1]));
    sp.beakTip = Math.max(...sp.beak.poly.map(p => p[1]));
    const hy = sp.beak.hinge.y, ik = img.width / PHOTO;

    // Lower mandible: the part of the beak below the jaw hinge, darker near the hinge where it sits in
    // the upper beak's shadow and lighter towards the tip
    const low = document.createElement('canvas');
    low.width = img.width; low.height = img.height;
    const lg = low.getContext('2d');
    lg.drawImage(sp.beakUpper, 0, 0);
    lg.globalCompositeOperation = 'source-atop';
    const shadow = lg.createLinearGradient(0, hy * ik, 0, sp.beakTip * ik);
    shadow.addColorStop(0, 'rgba(0,0,0,0.6)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.22)');
    lg.fillStyle = shadow;
    lg.fillRect(0, 0, low.width, low.height);
    sp.beakLower = low;

    // Cutting edge of the beak below the hinge (right corner -> tip -> left corner): the mouth opens along it
    const P = sp.beak.poly, below = P.filter(p => p[1] >= hy);
    const near = P.filter(p => Math.abs(p[1] - hy) < 90).map(p => p[0]);
    sp.mouthEdge = [[Math.max(...near), hy], ...below, [Math.min(...near), hy]].map(([x, y]) => ({ x, y }));
    // Tongue: a slim tapered shape lying on the lower mandible
    const tw = (Math.max(...near) - Math.min(...near)) * 0.11, tl = (sp.beakTip - hy) * 0.6;
    sp.tongue = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2, along = (1 - Math.cos(a)) / 2;
      sp.tongue.push({ x: sp.beak.hinge.x + Math.sin(a) * tw * (1 - along * 0.7), y: hy + tl * 0.15 + along * tl });
    }
    sp.eyeSpan = sp.eyes[1].x - sp.eyes[0].x;
    sp.eyeMid = { x: (sp.eyes[0].x + sp.eyes[1].x) / 2, y: (sp.eyes[0].y + sp.eyes[1].y) / 2 };
    sp.grid = buildGrid(sp.head, 0, 0, PHOTO, PHOTO, 18, 18);
    const bx = sp.beak.poly.map(p => p[0]);
    sp.beakGrid = buildGrid(sp.beakUpper, Math.min(...bx) - 6, sp.beakTop - 6, Math.max(...bx) + 6, sp.beakTip + 6, 6, 12);
    sp.lowerGrid = buildGrid(sp.beakLower, Math.min(...bx) - 6, hy - 4, Math.max(...bx) + 6, sp.beakTip + 6, 6, 10);
    sp.ready = true;
  };
  rgb.onload = mask.onload = onload;
  rgb.src = window.BIRD_IMAGES[key].rgb;
  mask.src = window.BIRD_IMAGES[key].mask;
  document.querySelectorAll(`[data-thumb="${key}"]`).forEach(t => t.src = window.BIRD_IMAGES[key].rgb);
}
Object.keys(speciesConfig).forEach(prepareSpecies);
