const video = document.getElementById('videoElement');

// Setup webcam video stream
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 640, height: 480 },
    audio: false,
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    };
  });
}

// Initialize Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

// Create chain group (5 links for demo)
const chainGroup = new THREE.Group();
const linkGeometry = new THREE.TorusGeometry(0.1, 0.025, 16, 100);
const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xD4AF37,
  metalness: 1,
  roughness: 0.3,
  emissive: 0x333300,
  emissiveIntensity: 0.2,
});
const linkCount = 5;
for (let i = 0; i < linkCount; i++) {
  const linkMesh = new THREE.Mesh(linkGeometry, goldMaterial);
  linkMesh.position.y = -i * 0.2;
  linkMesh.rotation.x = Math.PI / 2;
  linkMesh.rotation.z = i % 2 === 0 ? 0 : Math.PI / 4;
  chainGroup.add(linkMesh);
}
scene.add(chainGroup);

// Position camera
camera.position.set(0, 0, 3);

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Convert normalized face coordinates to Three.js coords
function convertToThreeCoords(xNorm, yNorm) {
  // xNorm, yNorm are between 0 and 1 (origin top-left)
  // Convert to centered coordinate system (-1 to 1)
  const x = (xNorm - 0.5) * 2;
  const y = -(yNorm - 0.5) * 2; // invert Y axis
  return { x, y };
}

async function main() {
  await setupCamera();

  const model = await facemesh.load();
  
  async function detectFace() {
    const predictions = await model.estimateFaces(video, false);
    if (predictions.length > 0) {
      const keypoints = predictions[0].scaledMesh;

      // Neck area approximation:
      // Use points below chin: Take average bottom of jaw points (landmark indices 152 and 148 are around chin)
      const jawLeft = keypoints[234]; // left jaw
      const jawRight = keypoints[454]; // right jaw
      const chin = keypoints[152]; // chin point
      
      // Calculate midpoint between left and right jaw
      const neckX = (jawLeft[0] + jawRight[0]) / 2;
      const neckY = (jawLeft[1] + jawRight[1]) / 2 + (chin[1] - ((jawLeft[1] + jawRight[1]) / 2)) * 0.5;

      // Normalize coordinates (video width & height 640 x 480 from setup)
      const normX = neckX / video.videoWidth;
      const normY = neckY / video.videoHeight;

      // Convert normalized to three.js coordinates (adjust Z for depth)
      const pos = convertToThreeCoords(normX, normY);

      // Update chain 3D object position smoothly
      chainGroup.position.x += (pos.x - chainGroup.position.x) * 0.2;
      chainGroup.position.y += (pos.y - 0.8 - chainGroup.position.y) * 0.2; // slightly below chin
      chainGroup.position.z = 0;

      // Optionally add subtle rotation based on face tilt using keypoints
      
    }
    renderer.render(scene, camera);
    requestAnimationFrame(detectFace);
  }
  detectFace();
}

main();
