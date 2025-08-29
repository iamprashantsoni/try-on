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

// Create chain group with linked spheres representing chain links
const chainGroup = new THREE.Group();
const linkCount = 8;
const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xD4AF37,
  metalness: 1,
  roughness: 0.25,
  emissive: 0x333300,
  emissiveIntensity: 0.2,
});

for (let i = 0; i < linkCount; i++) {
  const sphere = new THREE.Mesh(sphereGeometry, goldMaterial);
  sphere.position.x = (i % 2 === 0 ? 0 : 0.18);
  sphere.position.y = -i * 0.22;
  chainGroup.add(sphere);
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
  const x = (xNorm - 0.5) * 2;
  const y = -(yNorm - 0.5) * 2;
  return { x, y };
}

async function main() {
  await setupCamera();

  const model = await facemesh.load();
  
  async function detectFace() {
    const predictions = await model.estimateFaces(video, false);
    if (predictions.length > 0) {
      const keypoints = predictions[0].scaledMesh;

      // Approximate neck position using jaw landmarks
      const jawLeft = keypoints[234];
      const jawRight = keypoints[454];
      const chin = keypoints[152];
      
      const neckX = (jawLeft[0] + jawRight[0]) / 2;
      const neckY = (jawLeft[1] + jawRight[1]) / 2 + (chin[1] - ((jawLeft[1] + jawRight[1]) / 2)) * 0.5;

      const normX = neckX / video.videoWidth;
      const normY = neckY / video.videoHeight;

      const pos = convertToThreeCoords(normX, normY);

      // Smooth chain position update
      chainGroup.position.x += (pos.x - chainGroup.position.x) * 0.2;
      chainGroup.position.y += (pos.y - 0.8 - chainGroup.position.y) * 0.2;
      chainGroup.position.z = 0;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(detectFace);
  }
  detectFace();
}

main();
