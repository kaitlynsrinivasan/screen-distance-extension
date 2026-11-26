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

// "Too close" settings. A face looks wider on camera the closer it is, so we
// compare the current face width to the calibrated baseline width. A ratio of
// 1.15 means "your face looks 15% wider than at your normal distance".
const TOO_CLOSE_RATIO = 1.15;
// How many checks in a row (about one per second) must be "too close" before
// we treat it as real. Keeps one flickery frame from causing a false alarm.
const SUSTAINED_CHECKS_REQUIRED = 5;

// How often this window tells background.js "monitoring is still running".
// background.js uses that to record at most one daily_heartbeat per day.
const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// The user's "normal distance", measured as face width in pixels. null means
// they haven't calibrated yet.
let baselineWidth = null;

// Sustained-closeness tracking.
let consecutiveCloseChecks = 0;
// True once we've already reacted to the current "too close" stretch, so we
// react once per stretch instead of once per second.
let reminderActive = false;
// When the current reminder started (milliseconds since 1970), or null.
let reminderStartedAt = null;

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

// Sends a message to background.js. `target` says who it's for, `type` says
// what happened, and `details` adds any extra facts about it.
async function sendToBackground(type, details = {}) {
  try {
    await chrome.runtime.sendMessage({ target: "background", type, ...details });
  } catch (err) {
    console.error(`[monitor] couldn't send ${type} message:`, err);
  }
}

function updateBaselineText() {
  baselineText.textContent = baselineWidth
    ? `Baseline: ${baselineWidth.toFixed(1)}px`
    : "Not calibrated yet. Sit at a comfortable distance and click Calibrate.";
}

// Clears the closeness streak. If a reminder was showing, returns how many
// seconds it had been showing, so callers know the notification needs to be
// removed. Returns null if no reminder was showing.
function resetClosenessTracking() {
  const secondsShown = reminderActive
    ? Math.round((Date.now() - reminderStartedAt) / 1000)
    : null;

  consecutiveCloseChecks = 0;
  reminderActive = false;
  reminderStartedAt = null;
  return secondsShown;
}

// Feeds one new reading into the sustained-closeness logic. Returns:
//   { type: "remind", ratio }          — too close long enough: show a reminder
//   { type: "resolved", secondsShown } — user moved back while a reminder showed
//   null                               — nothing to do this time
function updateClosenessState(ratio) {
  if (ratio >= TOO_CLOSE_RATIO) {
    consecutiveCloseChecks += 1;
    if (consecutiveCloseChecks >= SUSTAINED_CHECKS_REQUIRED && !reminderActive) {
      reminderActive = true;
      reminderStartedAt = Date.now();
      return { type: "remind", ratio };
    }
    return null;
  }

  // Back at a safe distance: start over, and allow a future reminder.
  const secondsShown = resetClosenessTracking();
  if (secondsShown !== null) {
    return { type: "resolved", secondsShown };
  }
  return null;
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
        const ratio = width / baselineWidth;
        const event = updateClosenessState(ratio);

        if (event && event.type === "remind") {
          sendToBackground("TOO_CLOSE_DETECTED", {
            ratio: Number(event.ratio.toFixed(2)),
          });
        } else if (event && event.type === "resolved") {
          sendToBackground("BACK_AT_SAFE_DISTANCE", {
            reason: "moved_back",
            secondsShown: event.secondsShown,
          });
        }

        let note = "";
        if (reminderActive) {
          note = " — too close, sit back!";
        } else if (consecutiveCloseChecks > 0) {
          note = ` — getting close (${consecutiveCloseChecks}/${SUSTAINED_CHECKS_REQUIRED})`;
        }
        statusText.textContent =
          `Face width: ${width.toFixed(1)}px (${(ratio * 100).toFixed(0)}% of your baseline)${note}`;
      } else {
        statusText.textContent = `Face detected — box width: ${width.toFixed(1)}px`;
      }
    } else {
      // No face in view (user stepped away, say): they're no longer too
      // close, so remove any showing reminder and start fresh on return.
      const secondsShown = resetClosenessTracking();
      if (secondsShown !== null) {
        sendToBackground("BACK_AT_SAFE_DISTANCE", {
          reason: "left_frame",
          secondsShown,
        });
      }
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
    // A new baseline means any earlier "too close" count no longer applies.
    const secondsShown = resetClosenessTracking();
    if (secondsShown !== null) {
      sendToBackground("BACK_AT_SAFE_DISTANCE", {
        reason: "recalibrated",
        secondsShown,
      });
    }

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

    // Tell background.js we're up and running now, and keep telling it
    // periodically (it only records one heartbeat per day).
    sendToBackground("MONITORING_ACTIVE");
    setInterval(() => sendToBackground("MONITORING_ACTIVE"), HEARTBEAT_INTERVAL_MS);
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