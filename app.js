// Get elements
const video = document.getElementById('video');
const canvas = document.getElementById('webglCanvas');
const colorPicker = document.getElementById('colorPicker');

let renderer, scene, camera, lipsMesh;
let facemeshModel;
let lipColor = new THREE.Color(colorPicker.value);

// Lip landmark indices from MediaPipe FaceMesh for outer lips polygon
const outerLipsIndices = [
  61, 146, 91, 181, 84, 17, 314,
  405, 321, 375, 291, 308, 324,
  318, 402, 317
];

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

async function loadFacemesh() {
  await tf.setBackend('webgl');
  await tf.ready();
  facemeshModel = await facemesh.load();
}

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(640, 480);
  renderer.setClearColor(0x000000, 0); // Transparent background

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(0, 640, 480, 0, -1000, 1000);
  camera.position.z = 1;

  // Initialize lips mesh as empty geometry, will update each frame
  const geometry = new THREE.BufferGeometry();

  // Material: Simple matte transparent lipstick color
  const material = new THREE.MeshBasicMaterial({
    color: lipColor,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  lipsMesh = new THREE.Mesh(geometry, material);
  scene.add(lipsMesh);
}

// Convert FaceMesh 2D coords to Three.js coordinates for orthographic camera
function faceCoordToThree(coord) {
  // FaceMesh coordinates: [x,y]
  // Flip X for mirror effect as video is mirrored
  return [640 - coord[0], 480 - coord[1]];
}

function updateLipsMesh(scaledMesh) {
  // Extract outer lips points mapped to canvas coords
  const vertices = [];
  outerLipsIndices.forEach(idx => {
    const [x, y] = faceCoordToThree(scaledMesh[idx]);
    vertices.push(x, y, 0);
  });

  // Create face center point (average of lip vertices)
  const avg = vertices.reduce(
    (acc, val, i) => {
      if (i % 3 === 0) acc[0] += val;
      else if (i % 3 === 1) acc[1] += val;
      return acc;
    },
    [0, 0]
  );
  avg[0] /= outerLipsIndices.length;
  avg[1] /= outerLipsIndices.length;

  vertices.push(avg[0], avg[1], 0); // Add center vertex for fan geometry

  // Prepare geometry
  const position = new Float32Array(vertices);
  lipsMesh.geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));

  // Triangles for triangle fan
  const indices = [];
  const centerIndex = outerLipsIndices.length;
  for (let i = 0; i < outerLipsIndices.length; i++) {
    indices.push(i, (i + 1) % outerLipsIndices.length, centerIndex);
  }
  lipsMesh.geometry.setIndex(indices);

  lipsMesh.geometry.computeVertexNormals();
  lipsMesh.geometry.attributes.position.needsUpdate = true;
  lipsMesh.geometry.index.needsUpdate = true;
}

async function renderLoop() {
  const predictions = await facemeshModel.estimateFaces(video, false);

  if (predictions.length > 0 && predictions[0].scaledMesh) {
    updateLipsMesh(predictions[0].scaledMesh);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
}

async function main() {
  await setupCamera();
  await loadFacemesh();
  initThree();

  colorPicker.addEventListener('input', () => {
    lipColor.set(colorPicker.value);
    lipsMesh.material.color = lipColor;
  });

  renderLoop();
}

main();
