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
const calibrateBtn = document.getElementById("calibrateBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const baselineText = document.getElementById("baselineText");

// Calibration settings: take a handful of readings, half a second apart,
// and average them so one glitchy frame can't skew the baseline.
const CALIBRATION_SAMPLES = 5;
const CALIBRATION_DELAY_MS = 500;
const MIN_VALID_SAMPLES = 3; // need at least this many frames with a face found

// The user's "normal distance", measured as face width in pixels. null means
// they haven't calibrated yet.
let baselineWidth = null;

// Guards against overlapping work (see checkDistance / calibrate below).
let isChecking = false;
let isCalibrating = false;

async function loadModel() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("lib/models");
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  await video.play();
}

// A tiny helper that "pauses" an async function for some milliseconds:
// usage is `await sleep(500)`.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateBaselineText() {
  baselineText.textContent = baselineWidth
    ? `Baseline: ${baselineWidth.toFixed(1)}px`
    : "Not calibrated yet. Sit at a comfortable distance and click Calibrate.";
}

async function checkDistance() {
  // Skip this tick if the previous check is still running, or if the user is
  // mid-calibration (calibrate() is using the camera at that moment).
  if (isChecking || isCalibrating) return;
  isChecking = true;
  try {
    const detection = await faceapi.detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions()
    );
    if (detection) {
      const width = detection.box.width;
      if (baselineWidth) {
        const percent = (width / baselineWidth) * 100;
        statusText.textContent = `Face width: ${width.toFixed(1)}px (${percent.toFixed(0)}% of your baseline)`;
      } else {
        statusText.textContent = `Face detected — box width: ${width.toFixed(1)}px`;
      }
    } else {
      statusText.textContent = "No face detected — make sure you're visible to the camera.";
    }
  } catch (err) {
    console.error("[monitor] detection error:", err);
  } finally {
    isChecking = false;
  }
}

async function calibrate() {
  isCalibrating = true;
  calibrateBtn.disabled = true;
  statusText.textContent = "Calibrating — sit at a comfortable distance and hold still…";

  try {
    const samples = [];
    for (let i = 0; i < CALIBRATION_SAMPLES; i++) {
      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions()
      );
      if (detection) {
        samples.push(detection.box.width);
      }
      await sleep(CALIBRATION_DELAY_MS);
    }

    if (samples.length < MIN_VALID_SAMPLES) {
      statusText.textContent =
        "Couldn't see your face clearly enough. Make sure you're visible and try again.";
      return;
    }

    const total = samples.reduce((sum, width) => sum + width, 0);
    baselineWidth = total / samples.length;

    await chrome.storage.local.set({ baselineWidth });
    updateBaselineText();
    statusText.textContent = "Calibrated!";
  } catch (err) {
    console.error("[monitor] calibration failed:", err);
    statusText.textContent = "Calibration failed. Please try again.";
  } finally {
    // Runs no matter how we leave the try block, including the early
    // `return` above, so the button and the flag can never get stuck.
    isCalibrating = false;
    calibrateBtn.disabled = false;
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

    // Restore a previously saved baseline, if there is one.
    const stored = await chrome.storage.local.get("baselineWidth");
    baselineWidth = stored.baselineWidth || null;
    updateBaselineText();
    calibrateBtn.style.display = "block";

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
calibrateBtn.addEventListener("click", calibrate);

// On load: just try starting directly. If permission was already granted
// previously, this succeeds silently, the same way a website you've
// already allowed doesn't re-prompt you. If not, the catch block above
// reveals the button for a real, clickable grant.
startMonitoring();