const video = document.getElementById('videoElement');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const lipColorPicker = document.getElementById('lipColor');

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

function resizeCanvas() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

function drawLipsOverlay(ctx, keypoints, color) {
  // Outer lip indices based on FaceMesh
  const outerLips = [
    61, 146, 91, 181, 84, 17, 314, 405,
    321, 375, 291, 308, 324, 318, 402, 317,
  ];
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
  ctx.globalAlpha = 1;
}

async function main() {
  await setupCamera();
  resizeCanvas();

  const model = await facemesh.load();

  async function renderFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const predictions = await model.estimateFaces(video, false);
    if (predictions.length > 0) {
      const keypoints = predictions[0].scaledMesh;
      drawLipsOverlay(ctx, keypoints, lipColorPicker.value);
    }
    requestAnimationFrame(renderFrame);
  }
  renderFrame();
}

main();

window.addEventListener('resize', () => {
  resizeCanvas();
});
