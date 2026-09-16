// popup.js — settings UI + the one-time camera permission grant.
//
// Why the permission request lives here and not in offscreen.js: Chrome
// requires a user gesture on a *visible* page to show the camera permission
// prompt. This popup is visible and the button click is a user gesture, so
// this is the only place that can trigger the initial prompt.

const grantBtn = document.getElementById("grantBtn");
const statusDot = document.getElementById("statusDot");
const enabledToggle = document.getElementById("enabledToggle");
const todayCount = document.getElementById("todayCount");

grantBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // We don't need the stream here — we only wanted the permission prompt.
    // Immediately stop it so the camera light turns off.
    stream.getTracks().forEach((track) => track.stop());

    grantBtn.textContent = "Camera access granted";
    grantBtn.disabled = true;
    statusDot.classList.add("active");

    await chrome.storage.local.set({ cameraGranted: true });
  } catch (err) {
    grantBtn.textContent = "Camera access denied — click to retry";
    console.error("[popup] camera permission denied:", err);
  }
});

enabledToggle.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabledToggle.checked });
  // TODO (step 3): tell the offscreen document to pause/resume detection.
});

// Restore saved state when the popup opens.
(async function init() {
  const { cameraGranted, enabled, todayReminderCount } =
    await chrome.storage.local.get(["cameraGranted", "enabled", "todayReminderCount"]);

  if (cameraGranted) {
    grantBtn.textContent = "Camera access granted";
    grantBtn.disabled = true;
    statusDot.classList.add("active");
  }
  if (enabled === false) {
    enabledToggle.checked = false;
  }
  todayCount.textContent = todayReminderCount || 0;
})();
