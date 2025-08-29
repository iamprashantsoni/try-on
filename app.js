const video = document.getElementById('videoElement');
const lipColorInput = document.getElementById('lipColor');

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (err) {
    alert('Camera access denied or unavailable. Please allow camera permissions and reload.');
    console.error(err);
  }
}

async function main() {
  await setupCamera();

  const model = await facemesh.load();

  // Three.js setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

  // Adjust camera position to see full plane
  camera.position.z = 2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Wait for actual video dimensions for aspect ratio
  const aspect = video.videoWidth / video.videoHeight;
  const videoGeometry = new THREE.PlaneGeometry(4 * aspect, 4);
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const videoMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
  const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
  scene.add(videoMesh);

  // Lip overlay mesh and material setup
  const lipsGeometry = new THREE.BufferGeometry();
  const lipsMaterial = new THREE.MeshBasicMaterial({
    color: lipColorInput.value,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const lipsMesh = new THREE.Mesh(lipsGeometry, lipsMaterial);
  scene.add(lipsMesh);

  // Outer lips landmark indices
  const outerLipsIndices = [
    61, 146, 91, 181, 84, 17, 314, 405,
    321, 375, 291, 308, 324, 318, 402, 317,
  ];

  // Convert normalized coords to Three.js plane coords
  function toThreeCoords(x, y) {
    const threeX = (x - 0.5) * 4 * aspect;
    const threeY = -(y - 0.5) * 4;
    return [threeX, threeY];
  }

  function updateLipsGeometry(keypoints) {
    const positions = [];
    for (let idx of outerLipsIndices) {
      const [x, y] = keypoints[idx];
      const [tx, ty] = toThreeCoords(x / video.videoWidth, y / video.videoHeight);
      positions.push(tx, ty, 0);
    }

    // Calculate center point coordinates
    const centerX = positions.reduce((sum, v, i) => (i % 3 === 0 ? sum + v : sum), 0) / (positions.length / 3);
    const centerY = positions.reduce((sum, v, i) => (i % 3 === 1 ? sum + v : sum), 0) / (positions.length / 3);

    const newPositions = [...positions, centerX, centerY, 0];
    lipsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));

    const indices = [];
    for (let i = 0; i < outerLipsIndices.length; i++) {
      indices.push(i, (i + 1) % outerLipsIndices.length, outerLipsIndices.length);
    }
    lipsGeometry.setIndex(indices);
    lipsGeometry.computeVertexNormals();

    lipsGeometry.attributes.position.needsUpdate = true;
    lipsGeometry.index.needsUpdate = true;
  }

  lipColorInput.addEventListener('input', () => {
    lipsMaterial.color.set(lipColorInput.value);
  });

  async function render() {
    if (video.readyState >= 2) { // HAVE_CURRENT_DATA
      const predictions = await model.estimateFaces(video, false);
      if (predictions.length > 0) {
        updateLipsGeometry(predictions[0].scaledMesh);
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  render();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main();
