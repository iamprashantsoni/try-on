const video = document.getElementById('video');

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 640, height: 480 },
    audio: false
  });
  video.srcObject = stream;
  await new Promise((resolve) => (video.onloadedmetadata = resolve));
  video.play();
}

async function main() {
  await setupCamera();
  const model = await facemesh.load();

  // Setup Three.js
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camera.position.z = 2;

  // Create video texture and plane
  const videoTexture = new THREE.VideoTexture(video);
  videoTexture.minFilter = THREE.LinearFilter;
  videoTexture.magFilter = THREE.LinearFilter;

  const videoGeometry = new THREE.PlaneGeometry(4, 3); // Aspect ratio of 4:3
  const videoMaterial = new THREE.MeshBasicMaterial({map: videoTexture});
  const videoMesh = new THREE.Mesh(videoGeometry, videoMaterial);
  scene.add(videoMesh);

  // Create a lips overlay mesh (a simple plane that will be positioned/scaled dynamically)
  const lipsGeometry = new THREE.BufferGeometry();
  // We'll update lipsGeometry attributes dynamically based on lip landmarks

  // Material for lips tint (semi-transparent red)
  const lipsMaterial = new THREE.MeshBasicMaterial({color: 0xe4002b, transparent: true, opacity: 0.5, side: THREE.DoubleSide});
  
  // Mesh initialized with placeholder geometry
  const lipsMesh = new THREE.Mesh(lipsGeometry, lipsMaterial);
  scene.add(lipsMesh);


  // Helper: Convert 2D normalized video coordinates to Three.js plane coords
  function toThreeCoords(x, y) {
    // x, y normalized between 0 and 1 (top-left origin)
    const threeX = (x - 0.5) * 4;  // range -2 to 2
    const threeY = -(y - 0.5) * 3; // range -1.5 to 1.5 invert Y
    return [threeX, threeY];
  }

  // Indices for outer lips vertices in FaceMesh
  const outerLipsIndices = [
    61, 146, 91, 181, 84, 17, 314, 405,
    321, 375, 291, 308, 324, 318, 402, 317
  ];

  function updateLipsGeometry(keypoints) {
    // Map 2D lip points to 3D positions on plane (z=0)
    const positions = [];
    for (let idx of outerLipsIndices) {
      let [x, y] = keypoints[idx];
      let [tx, ty] = toThreeCoords(x / video.videoWidth, y / video.videoHeight);
      positions.push(tx, ty, 0);
    }

    // Create geometry attributes
    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
    lipsGeometry.setAttribute('position', positionAttribute);

    // Create simple face using TriangleFan for lips polygon (approximate)
    // Draw triangles between center point and outer lip points
    // We set an approximate center point
    const centerX = positions.reduce((sum, val, i) => (i % 3 === 0 ? sum + val : sum), 0) / (positions.length/3);
    const centerY = positions.reduce((sum, val, i) => (i % 3 === 1 ? sum + val : sum), 0) / (positions.length/3);

    // Build index array for triangle fan
    const indices = [];
    for (let i = 0; i < outerLipsIndices.length; i++) {
      indices.push(i);
      indices.push((i+1) % outerLipsIndices.length);
      indices.push(outerLipsIndices.length); // center vertex index (to be added below)
    }

    // Append center point to positions array
    const newPositions = [...positions, centerX, centerY, 0];
    lipsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    lipsGeometry.setIndex(indices);
    lipsGeometry.computeVertexNormals();
    lipsGeometry.attributes.position.needsUpdate = true;
    lipsGeometry.index.needsUpdate = true;
  }

  async function animate() {
    const predictions = await model.estimateFaces(video, false);
    if (predictions.length > 0) {
      updateLipsGeometry(predictions[0].scaledMesh);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main();
