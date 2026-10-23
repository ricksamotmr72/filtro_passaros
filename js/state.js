// Estado compartilhado da aplicação e canvases usados por todos os módulos.

// Global Application State
const state = {
  activeSpecies: 'woodpecker',
  opacity: 1.0,
  sizeScale: 1.0,
  offsetY: 0,
  syncMouth: true,
  syncBlink: true,
  featherSkin: true,
  showParticles: true,
  isStreaming: false,
  mouthSmooth: 0,
  jaw: 0,                // beak opening angle (radians, before the species factor) and its spring velocity
  jawVel: 0,
  time: 0,
  frame: 0,
  smoothPts: null,
  eyeRef: [0.28, 0.28],  // per-eye "fully open" ratio, adapts to each child's eyes
  lids: [0, 0],          // smoothed eyelid closure for the bird's [image-left, image-right] eye
  light: 1,
  face: null,            // 3D model of the child's face (learned on the fly), see tracking.js
  pose: null             // smoothed rigid head pose: { R, s, t }
};


const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const supportsFilter = 'filter' in canvasCtx;

// Offscreen layer where the side plumage is composed before being blended over the face
const plumageCanvas = document.createElement('canvas');
const plumageCtx = plumageCanvas.getContext('2d');

// Per-frame bird source (photo + eyelids) and the layer it is projected into
const frameCanvas = document.createElement('canvas');
const frameCtx = frameCanvas.getContext('2d');
const warpCanvas = document.createElement('canvas');
const warpCtx = warpCanvas.getContext('2d');

// Tiny canvas used to measure the scene brightness
const lightCanvas = document.createElement('canvas');
lightCanvas.width = 16; lightCanvas.height = 12;
const lightCtx = lightCanvas.getContext('2d', { willReadFrequently: true });

let camera = null;
let particles = [];
