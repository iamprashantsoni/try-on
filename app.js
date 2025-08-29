const video = document.getElementById('videoElement');

// Access webcam, set video src
navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
  .then((stream) => {
    video.srcObject = stream;
  }).catch(err => {
    alert('Error accessing camera: ' + err);
  });

// Set up Three.js scene with transparent background
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0); // transparent bg
document.body.appendChild(renderer.domElement);

// Lighting for shiny gold effect
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 1, 1);
scene.add(directionalLight);

// Create static gold chain group
const chainGroup = new THREE.Group();
const linkGeometry = new THREE.TorusGeometry(0.2, 0.05, 16, 100);
const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xD4AF37, metalness: 1, roughness: 0.3,
  emissive: 0x333300, emissiveIntensity: 0.2,
});

const linkCount = 10;
for(let i=0; i < linkCount; i++) {
  const linkMesh = new THREE.Mesh(linkGeometry, goldMaterial);
  linkMesh.position.y = -i * 0.35;
  linkMesh.rotation.x = Math.PI / 2;
  linkMesh.rotation.z = i % 2 === 0 ? 0 : Math.PI / 4;
  chainGroup.add(linkMesh);
}
scene.add(chainGroup);

// Position camera
camera.position.set(0, 0, 3);

// On resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Update loop
function animate() {
  requestAnimationFrame(animate);
  // Optional: subtle chain rotation
  chainGroup.rotation.y += 0.005;

  // Position chain fixed roughly near bottom center simulating 'neck'
  chainGroup.position.set(0, -0.8, 0);

  renderer.render(scene, camera);
}

animate();
