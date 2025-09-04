const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const lipColorPicker = document.getElementById('lipColor');

const outerLips = [
  61, 146, 91, 181, 84, 17, 314, 405,
  321, 375, 291, 308, 324, 318, 402, 317,
];

let lastLipColor = lipColorPicker.value;
lipColorPicker.addEventListener('input', () => {
  lastLipColor = lipColorPicker.value;
});

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    return new Promise(resolve => {
      video.onloadedmetadata = () => {
        video.play();
        resolve(video);
      };
    });
  } catch (err) {
    alert('Camera access denied or unavailable. Please allow camera permissions and reload.');
    throw err;
  }
}

function resizeCanvasToVideo() {
  if (video.videoWidth && video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
}

// STEP 1: Debug function to see if image/video drawing happens
function testDrawBG() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#AAAAFF';
  ctx.fillRect(10, 10, 50, 50);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
}

// STEP 2: Debug draw green dots for all face keypoints, blue dots for lips only
function debugDrawDots(keypoints) {
  // draw all points small, lips larger
  ctx.save();
  ctx.fillStyle = "#00FF00";
  for (let i = 0; i < keypoints.length; i++) {
    const [x, y] = keypoints[i];
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = "#0077ff";
  outerLips.forEach(pointIdx => {
    const [x, y] = keypoints[pointIdx];
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
  ctx.restore();
}

// STEP 3: Debug polygon drawing, logs and outline
function drawLipsOverlay(ctx, keypoints, color) {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = color;

  if (!keypoints || keypoints.length < Math.max(...outerLips)) {
    console.log("Insufficient keypoints for drawing lips!");
    ctx.restore();
    return;
  }

  console.log("Drawing lips polygon with color:", color);
  ctx.beginPath();
  outerLips.forEach((pointIdx, i) => {
    const [x, y] = keypoints[pointIdx];
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = "#FF00FF";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

async function main() {
  await setupCamera();

  // Wait for video size and resize canvas
  function checkVideoReady() {
    return new Promise(resolve => {
      function tryReady() {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          resizeCanvasToVideo();
          resolve();
        } else {
          setTimeout(tryReady, 50);
        }
      }
      tryReady();
    });
  }
  await checkVideoReady();

  // STEP 1: Confirm video and canvas drawing
  testDrawBG();
  console.log("STEP 1: BG and video draw should now be visible.");

  const model = await facemesh.load();
  console.log("FaceMesh model loaded!");

  async function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const predictions = await model.estimateFaces(video, false);
    if (!predictions || predictions.length === 0) {
      console.log("No face detected in this frame.");
    } else {
      const keypoints = predictions[0].scaledMesh;
      // STEP 2: Visualize landmarks
      debugDrawDots(keypoints);

      // STEP 3: Try to draw lips overlay
      drawLipsOverlay(ctx, keypoints, lastLipColor);
    }
    requestAnimationFrame(renderFrame);
  }

  renderFrame();
}

window.addEventListener('resize', resizeCanvasToVideo);

main();
