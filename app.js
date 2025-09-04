// Get elements
const video = document.getElementById('video');
const canvas = document.getElementById('webglCanvas');
const colorPicker = document.getElementById('colorPicker');

let renderer, scene, camera, lipsMesh;
let facemeshModel;
let lipColor = new THREE.Color(colorPicker.value);

// Lip landmark indices for outer lips polygon
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

function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(640, 480);
  renderer.setClearColor(0x000000, 0); // transparent background

  scene = new THREE.Scene();

  // Orthographic camera: left, right, top, bottom
  camera = new THREE.OrthographicCamera(0, 640, 480, 0, -1000, 1000);
  camera.position.z = 1;

  // Video texture setup for background plane
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;
  videoTexture.format = THREE.RGBAFormat;

  const backgroundGeometry = new THREE.PlaneGeometry(640, 480);
  const backgroundMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
  const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
  // Position to center the plane
  backgroundMesh.position.set(640 / 2, 480 / 2, -1);
  scene.add(backgroundMesh);

  // Lips mesh with empty geometry for now
  const geometry = new THREE.BufferGeometry();
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

// Coordinate converter from FaceMesh to Three.js coordinates,
// compensating for video mirror (flip x), and y-axis inversion
function mapFaceMesh2ThreeJS(point) {
  const x = video.videoWidth - point[0];       // flip x for mirrored video
  const y = video.videoHeight - point[1];      // flip y for Three.js origin bottom-left
  return [x, y];
}

function updateLipsMesh(scaledMesh) {
  const vertices = [];
  outerLipsIndices.forEach(idx => {
    const [x, y] = mapFaceMesh2ThreeJS(scaledMesh[idx]);
    vertices.push(x, y, 0);
  });

  // Calculate center point of lips polygon for triangle fan
  const n = outerLipsIndices.length;
  let sumX = 0, sumY = 0;
  for(let i = 0; i < vertices.length; i += 3) {
    sumX += vertices[i];
    sumY += vertices[i + 1];
  }
  vertices.push(sumX / n, sumY / n, 0); // center vertex

  // Create/update geometry attributes
  const positionAttribute = new THREE.Float32BufferAttribute(vertices, 3);
  lipsMesh.geometry.setAttribute('position', positionAttribute);

  // Triangle fan indices
  const indices = [];
  const centerIndex = n;
  for (let i = 0; i < n; i++) {
    indices.push(i, (i + 1) % n, centerIndex);
  }
  lipsMesh.geometry.setIndex(indices);

  lipsMesh.geometry.computeVertexNormals();
  lipsMesh.geometry.attributes.position.needsUpdate = true;
  lipsMesh.geometry.index.needsUpdate = true;
}

async function main() {
  await setupCamera();

  await tf.setBackend('webgl');
  await tf.ready();

  facemeshModel = await facemesh.load();

  initThree();

  colorPicker.addEventListener('input', () => {
    lipColor.set(colorPicker.value);
    lipsMesh.material.color = lipColor;
  });

  async function renderLoop() {
    if (video.readyState >= 2) {
      const predictions = await facemeshModel.estimateFaces(video, false);
      if (predictions.length > 0 && predictions[0].scaledMesh) {
        updateLipsMesh(predictions[0].scaledMesh);
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

main();
