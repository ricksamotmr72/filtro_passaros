// Configuração das aves (medidas nas fotos de assets/images) e conjuntos de pontos do rosto (MediaPipe).

// Every coordinate below is in the ORIGINAL photo pixels (1254 x 1254), measured on the files in assets/images/.
// eyes[0] is the eye on the left side of the photo. beak.depth: how far (in face units) the beak tip
// sticks out towards the camera, which is what makes it point where the child turns.
const PHOTO = 1254;
const speciesConfig = {
  woodpecker: {
    name: 'Pica-Pau',
    fit: 1.05,
    eyes: [{ x: 413, y: 543, rx: 42, ry: 46 }, { x: 842, y: 543, rx: 42, ry: 46 }],
    lid: ['#141416', '#34343a'],
    beak: {
      poly: [[627, 518], [668, 540], [720, 610], [770, 660], [812, 684], [760, 712], [700, 770], [665, 860], [630, 972],
        [592, 860], [555, 770], [495, 712], [445, 684], [485, 660], [535, 610], [586, 540]],
      hinge: { x: 627, y: 690 }, gapeMul: 0.8, depth: 0.6, gape: '#5b1414'
    },
    plumage: { base: '#121214', featherSize: 0.07, texture: 0.5 },
    markings: 'woodpecker',
    particleColors: ['#dc2626', '#18181b', '#f5f0e6']
  },
  toucan: {
    name: 'Tucano',
    fit: 1.12,
    eyes: [{ x: 375, y: 330, rx: 40, ry: 66 }, { x: 877, y: 328, rx: 40, ry: 66 }],
    lid: ['#d9590c', '#f59a2c'],
    beak: {
      poly: [[625, 138], [700, 148], [772, 188], [818, 258], [840, 350], [852, 470], [850, 530], [835, 580], [805, 650],
        [765, 760], [720, 900], [682, 1000], [658, 1080], [632, 1150], [602, 1080], [578, 1000], [540, 900], [495, 760],
        [455, 650], [425, 580], [402, 530], [400, 470], [412, 350], [436, 258], [480, 188], [552, 148]],
      hinge: { x: 625, y: 500 }, gapeMul: 0.6, depth: 1.0, gape: '#7f1d1d',
      fillAbove: true   // the casque covers the whole forehead: fill behind it with the feathers above
    },
    plumage: { base: '#0b0b0f', featherSize: 0.07, texture: 0.5 },
    markings: 'toucan',
    particleColors: ['#f97316', '#fffbeb', '#0b0b0f']
  },
  beijaflor: {
    name: 'Beija-Flor',
    fit: 1.25,
    eyes: [{ x: 375, y: 378, rx: 50, ry: 67 }, { x: 882, y: 378, rx: 50, ry: 67 }],
    lid: ['#1f1a14', '#3a3226'],
    beak: {
      poly: [[626, 412], [666, 418], [712, 450], [735, 494], [706, 518], [697, 566], [670, 686], [650, 846], [638, 966],
        [627, 1040], [615, 966], [602, 846], [582, 686], [556, 566], [546, 518], [519, 494], [542, 450], [588, 418]],
      hinge: { x: 627, y: 510 }, gapeMul: 0.28, depth: 0.9, gape: '#3b0a0a'
    },
    plumage: { base: '#167a3c', featherSize: 0.04, texture: 0.45 },
    markings: 'beijaflor',
    particleColors: ['#10b981', '#2563eb', '#06b6d4']
  }
};

const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

// Landmarks used to solve the head pose: forehead, temples, eye corners, nose bridge and cheekbones.
// They barely move with expressions, so talking, smiling or blinking never shakes the mask.
const RIGID_LANDMARKS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 109, 67, 103, 54, 21, 162, 127, 234,
  151, 9, 8, 168, 6, 197, 33, 133, 263, 362, 117, 346, 123, 352, 50, 280, 108, 337, 69, 299];

// Landmarks describing the relief the mask rests on. The nose tip, lips and eyelids are left out, so the
// mask passes smoothly over them like a real one.
const SHAPE_LANDMARKS = [...new Set([...FACE_OVAL, ...RIGID_LANDMARKS,
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 118, 119, 100, 47, 347, 348, 329, 277,
  187, 411, 205, 425, 207, 427, 206, 426, 199, 175])];
