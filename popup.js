// popup.js — settings UI + a button to open the monitoring window.
//
// Note: this button's job is just "open the monitoring window" — it's a
// repeatable action, not a one-time setup step. The actual camera
// permission grant happens inside monitor.js itself, the first time that
// window opens without prior access.

const grantBtn = document.getElementById("grantBtn");
const statusDot = document.getElementById("statusDot");
const enabledToggle = document.getElementById("enabledToggle");
const persistentToggle = document.getElementById("persistentToggle");
const todayCount = document.getElementById("todayCount");

// Tells background.js that a setting changed, so it can record the event.
function reportSettingChange(setting, value) {
  chrome.runtime
    .sendMessage({ target: "background", type: "SETTING_CHANGED", setting, value })
    .catch((err) => console.error("[popup] couldn't report setting change:", err));
}

grantBtn.addEventListener("click", () => {
  chrome.windows.create({
    url: chrome.runtime.getURL("monitor.html"),
    type: "popup",
    width: 340,
    height: 280,
  });
});

enabledToggle.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabledToggle.checked });
  reportSettingChange("reminders_enabled", enabledToggle.checked);
  // TODO (step 4): tell monitor.js to pause/resume detection.
});

persistentToggle.addEventListener("change", async () => {
  await chrome.storage.local.set({ persistentReminders: persistentToggle.checked });
  reportSettingChange("persistent_reminders", persistentToggle.checked);
});

// Restore saved state when the popup opens.
(async function init() {
  const { cameraGranted, enabled, persistentReminders, todayReminderCount } =
    await chrome.storage.local.get([
      "cameraGranted",
      "enabled",
      "persistentReminders",
      "todayReminderCount",
    ]);

  // Reflect whether camera access is currently working, but keep the button
  // clickable either way — reopening the monitor window is always a valid
  // action, whether to start it fresh or bring it back after it was closed.
  grantBtn.textContent = cameraGranted ? "Open monitoring window" : "Grant camera access";
  if (cameraGranted) {
    statusDot.classList.add("active");
  }

  if (enabled === false) {
    enabledToggle.checked = false;
  }
  // Off unless the user has explicitly turned it on.
  persistentToggle.checked = persistentReminders === true;
  todayCount.textContent = todayReminderCount || 0;
})();