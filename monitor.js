// monitor.js — runs in a real, visible (though small) extension window.
//
// This replaces both offscreen.js and permission.js. Why: offscreen
// documents turned out not to reliably inherit camera permission granted
// elsewhere in the extension (a known rough edge in Chrome's platform, not
// something specific to our code — confirmed by other developers hitting
// the same "Permission dismissed" error). A normal window doesn't have that
// problem, since it can receive a real click and Chrome's usual "remember
// this permission for next time" behavior works exactly like it does for
// any regular website. The trade-off: this window has to stay open (it can
// be minimized) for monitoring to keep working — it's no longer fully
// invisible the way the offscreen approach would have been.

const video = document.getElementById("video");
const grantBtn = document.getElementById("grantBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");

async function loadModel() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("lib/models");
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();
}

// Guards against two detection checks overlapping if one ever takes longer
// than the interval between checks (unlikely with this small a model, but
// cheap to protect against).
let isChecking = false;

async function checkDistance() {
  if (isChecking) return;
  isChecking = true;
  try {
    const detection = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions()
    );
    if (detection) {
      statusText.textContent = `Face detected — box width: ${detection.box.width.toFixed(1)}px`;
    } else {
      statusText.textContent = "No face detected — make sure you're visible to the camera.";
    }
  } catch (err) {
    console.error("[monitor] detection error:", err);
  } finally {
    isChecking = false;
  }
}

async function startMonitoring() {
  try {
    statusText.textContent = "Loading face detection model…";
    await loadModel();

    statusText.textContent = "Starting camera…";
    await startCamera();

    statusDot.classList.add("active");
    grantBtn.style.display = "none";
    await chrome.storage.local.set({ cameraGranted: true });

    setInterval(checkDistance, 1000);
  } catch (err) {
    console.error("[monitor] setup failed:", err);
    // Camera access isn't available yet (or was revoked) — show the button
    // so the user can (re-)grant it with a real click.
    statusText.textContent = "Camera access needed to start monitoring.";
    grantBtn.style.display = "block";
    await chrome.storage.local.set({ cameraGranted: false });
  }
}

grantBtn.addEventListener("click", startMonitoring);

// On load: just try starting directly. If permission was already granted
// previously, this succeeds silently, the same way a website you've
// already allowed doesn't re-prompt you. If not, the catch block above
// reveals the button for a real, clickable grant.
startMonitoring();