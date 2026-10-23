// Aplicação: câmera, MediaPipe Face Mesh, laço principal de cada quadro e controles da interface.

// ---------- Canvas setup & main loop ----------
function resizeCanvas() {
  const parent = canvasElement.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasElement.width = Math.round(parent.clientWidth * dpr);
  canvasElement.height = Math.round(parent.clientHeight * dpr);
  plumageCanvas.width = warpCanvas.width = canvasElement.width;
  plumageCanvas.height = warpCanvas.height = canvasElement.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Fit the video like CSS object-cover (no stretching)
function coverRect(iw, ih, W, H) {
  const s = Math.max(W / iw, H / ih);
  const w = iw * s, h = ih * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

let landmarkLabelSet = false;

function onResults(results) {
  state.time += 0.03;
  state.frame++;
  const W = canvasElement.width, H = canvasElement.height;
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, W, H);

  const img = results.image;
  const iw = img.videoWidth || img.width || W, ih = img.videoHeight || img.height || H;
  const rect = coverRect(iw, ih, W, H);
  canvasCtx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
  updateLighting(img);

  const species = speciesConfig[state.activeSpecies];
  if (species.ready && results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const raw = results.multiFaceLandmarks[0].map(p => ({
      x: rect.x + p.x * rect.w,
      y: rect.y + p.y * rect.h,
      z: p.z * rect.w
    }));
    const pts = smoothLandmarks(raw);
    const f = computeFrame(pts);

    if (!landmarkLabelSet) {
      document.getElementById('landmark-count').textContent = `${pts.length} Pontos Anatômicos`;
      landmarkLabelSet = true;
    }

    // Lip gap in face units (ignores the small gap of relaxed lips)
    const gap = Math.max(0, toLocal(f, pts[14]).y - toLocal(f, pts[13]).y - 0.03);
    state.mouthSmooth += (gap - state.mouthSmooth) * 0.35;
    // Jaw angle follows the lips through a soft spring: quick to open, with a slight natural settle
    const jawTarget = clamp(gap * 2.4, 0, 0.75);
    state.jawVel = state.jawVel * 0.55 + (jawTarget - state.jaw) * 0.3;
    state.jaw = clamp(state.jaw + state.jawVel, 0, 0.9);
    document.getElementById('mouth-open-value').textContent = `${Math.round(clamp(gap / 0.35, 0, 1) * 100)}%`;

    const oval = buildFaceOval(pts, f, 1.08);

    // 1. Plumage over hair/cheeks around the photo
    if (state.featherSkin) {
      renderPlumage(canvasCtx, f, species, oval);
    }

    // 2. Real bird photo: head, synced eyelids and articulated beak
    drawBirdHead(canvasCtx, pts, f, species, trackHead(pts, f));
    document.getElementById('eye-state-value').textContent =
      Math.max(state.lids[0], state.lids[1]) > 0.5 ? 'Piscando' : 'Abertos';

    if (state.showParticles) {
      spawnDown(f, species, oval);
    }
  } else {
    resetTracking();
  }

  if (state.showParticles) {
    drawParticles(canvasCtx);
  }

  canvasCtx.restore();
}

async function initCamera() {
  const statusBadge = document.getElementById('status-badge');
  const placeholder = document.getElementById('camera-placeholder');

  try {
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span> Conectando...`;

    camera = new Camera(videoElement, {
      onFrame: async () => {
        await faceMesh.send({ image: videoElement });
      },
      width: 1280,
      height: 720
    });

    await camera.start();
    state.isStreaming = true;

    videoElement.classList.remove('hidden');
    placeholder.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => placeholder.classList.add('hidden'), 300);

    statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Câmera Ativa`;

    document.getElementById('toggle-camera-btn').innerHTML = `<i class="fa-solid fa-video-slash"></i><span>Parar Câmera</span>`;
    document.getElementById('toggle-camera-btn').classList.replace('bg-cyan-600', 'bg-rose-600');

  } catch (err) {
    console.error("Erro na Câmera:", err);
    statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20";
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-400"></span> Erro de Acesso`;
  }
}

// Toggle Camera State
document.getElementById('toggle-camera-btn').addEventListener('click', () => {
  if (state.isStreaming && camera) {
    camera.stop();
    state.isStreaming = false;
    document.getElementById('webcam').classList.add('hidden');
    document.getElementById('camera-placeholder').classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    document.getElementById('toggle-camera-btn').innerHTML = `<i class="fa-solid fa-video"></i><span>Iniciar Câmera</span>`;
    document.getElementById('toggle-camera-btn').classList.replace('bg-rose-600', 'bg-cyan-600');

    const statusBadge = document.getElementById('status-badge');
    statusBadge.className = "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20";
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Câmera Pausada`;
  } else {
    initCamera();
  }
});

document.getElementById('start-cam-banner-btn').addEventListener('click', initCamera);

// Species Grid Selector
document.querySelectorAll('.species-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.species-btn').forEach(b => {
      b.classList.remove('active', 'border-cyan-500/60', 'bg-cyan-500/10');
      b.classList.add('border-slate-800', 'bg-slate-900/50');
    });

    const target = e.currentTarget;
    target.classList.add('active', 'border-cyan-500/60', 'bg-cyan-500/10');
    target.classList.remove('border-slate-800', 'bg-slate-900/50');

    state.activeSpecies = target.getAttribute('data-species');
    document.getElementById('active-species-name').textContent = speciesConfig[state.activeSpecies].name;
    particles = [];
  });
});

// Adjustment Sliders
document.getElementById('opacity-slider').addEventListener('input', (e) => {
  state.opacity = e.target.value / 100;
  document.getElementById('opacity-val').textContent = `${e.target.value}%`;
});

document.getElementById('size-slider').addEventListener('input', (e) => {
  state.sizeScale = e.target.value / 100;
  document.getElementById('size-val').textContent = `${(e.target.value / 100).toFixed(2)}x`;
});

document.getElementById('offset-slider').addEventListener('input', (e) => {
  state.offsetY = e.target.value / 100;
  document.getElementById('offset-val').textContent = e.target.value > 0 ? `+${e.target.value}` : e.target.value;
});

// Checkbox Toggles
document.getElementById('mouth-sync-toggle').addEventListener('change', (e) => {
  state.syncMouth = e.target.checked;
});

document.getElementById('blink-toggle').addEventListener('change', (e) => {
  state.syncBlink = e.target.checked;
  state.lids = [0, 0];
});

document.getElementById('feather-skin-toggle').addEventListener('change', (e) => {
  state.featherSkin = e.target.checked;
});

document.getElementById('particles-toggle').addEventListener('change', (e) => {
  state.showParticles = e.target.checked;
});

// Snapshot Modal Handling
const modal = document.getElementById('snapshot-modal');
const snapshotImg = document.getElementById('snapshot-img');
const downloadBtn = document.getElementById('download-btn');

document.getElementById('snapshot-btn').addEventListener('click', () => {
  // Mirror the capture so the photo matches what the user sees on screen
  const snap = document.createElement('canvas');
  snap.width = canvasElement.width;
  snap.height = canvasElement.height;
  const s = snap.getContext('2d');
  s.translate(snap.width, 0);
  s.scale(-1, 1);
  s.drawImage(canvasElement, 0, 0);
  const dataURL = snap.toDataURL('image/png');
  snapshotImg.src = dataURL;
  downloadBtn.href = dataURL;
  modal.classList.remove('hidden');
});

document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.add('hidden'));
document.getElementById('modal-close-btn').addEventListener('click', () => modal.classList.add('hidden'));

