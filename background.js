// background.js — Manifest V3 service worker
//
// Since camera work happens in monitor.js (a real window), this file is a
// pure dispatcher: it listens for messages from monitor.js and the popup, and
// turns them into native OS notifications and analytics events.

// Loads analytics.js into this file, making its `track` function available.
importScripts("analytics.js");

// A fixed ID means a new reminder replaces any existing one instead of
// stacking up, and lets us remove that specific notification later.
const REMINDER_NOTIFICATION_ID = "too-close-reminder";

// Shows the reminder notification. It reads the user's "persistent
// reminders" setting each time, so a change in the popup takes effect on
// the very next reminder. `ratio` is how close the user was (1.0 = baseline).
async function showReminder(ratio) {
  const { persistentReminders } = await chrome.storage.local.get("persistentReminders");
  const persistent = persistentReminders === true;

  chrome.notifications.create(
    REMINDER_NOTIFICATION_ID,
    {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "You're sitting close to the screen",
      message: "Try scooting back a bit.",
      priority: 1,
      // Only ask the OS to keep the notification on screen if the user
      // opted in. This path needs extra setup in the OS's notification
      // settings, so it's off by default (see README → Troubleshooting).
      requireInteraction: persistent,
    },
    () => {
      if (chrome.runtime.lastError) {
        // Chrome couldn't create the notification: say why, and don't count
        // it as a reminder that was shown.
        console.error("[background] notification failed:", chrome.runtime.lastError.message);
        return;
      }
      track("reminder_shown", { distance_ratio: ratio, persistent });
    }
  );
}

// Records at most one daily_heartbeat per calendar day. Called whenever the
// monitor window says it's still running; extra calls on the same day do
// nothing. This is what lets PostHog tell which days an install was active.
async function trackDailyHeartbeat() {
  // "en-CA" formats dates as YYYY-MM-DD, in the user's local time zone.
  const today = new Date().toLocaleDateString("en-CA");
  const { lastHeartbeatDate } = await chrome.storage.local.get("lastHeartbeatDate");
  if (lastHeartbeatDate === today) return;

  await chrome.storage.local.set({ lastHeartbeatDate: today });
  track("daily_heartbeat");
}

// Fires when the extension is first installed, updated, or reloaded. We only
// count genuine first installs.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    track("extension_installed");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "background") return;

  switch (message.type) {
    case "TOO_CLOSE_DETECTED":
      showReminder(message.ratio);
      break;

    case "BACK_AT_SAFE_DISTANCE":
      chrome.notifications.clear(REMINDER_NOTIFICATION_ID);
      track("reminder_resolved", {
        reason: message.reason,
        seconds_shown: message.secondsShown,
      });
      break;

    case "SETTING_CHANGED":
      track("settings_changed", { setting: message.setting, value: message.value });
      break;

    case "MONITORING_ACTIVE":
      trackDailyHeartbeat();
      break;

    default:
      break;
  }

  sendResponse({ ok: true });
});