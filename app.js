const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const lipColorPicker = document.getElementById('lipColor');

// Lip indices for FaceMesh
const outerLips = [
  61, 146, 91, 181, 84, 17, 314, 405,
  321, 375, 291, 308, 324, 318, 402, 317,
];

let lastLipColor = lipColorPicker.value;

// Listen for color change
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
    return new Promise((resolve) => {
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

function drawLipsOverlay(ctx, keypoints, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
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

  // DEBUG: draw points
  /*
  ctx.fillStyle = "#00ff00";
  outerLips.forEach((pointIdx) => {
    const [x, y] = keypoints[pointIdx];
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fill();
  });
  */
  ctx.restore();
}

async function main() {
  await setupCamera();

  // Wait for video size and resize canvas
  function checkVideoReady() {
    return new Promise((resolve) => {
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

  const model = await facemesh.load();

  async function renderFrame() {
    if (video.readyState >= 2 && canvas.width > 0 && canvas.height > 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const predictions = await model.estimateFaces(video, false);
      // DEBUG: log predictions count
      // console.log("Predictions:", predictions.length);

      if (predictions.length > 0 && predictions[0].scaledMesh) {
        drawLipsOverlay(ctx, predictions[0].scaledMesh, lastLipColor);
      }
    }
    requestAnimationFrame(renderFrame);
  }

  renderFrame();
}

window.addEventListener('resize', resizeCanvasToVideo);

main();
