// background.js — Manifest V3 service worker
//
// Since camera work happens in monitor.js (a real window), this file is a
// pure dispatcher: it listens for messages from monitor.js and turns them
// into native OS notifications.

// A fixed ID means a new reminder replaces any existing one instead of
// stacking up, and lets us remove that specific notification later.
const REMINDER_NOTIFICATION_ID = "too-close-reminder";

// Shows the reminder notification. It reads the user's "persistent
// reminders" setting each time, so a change in the popup takes effect on
// the very next reminder.
async function showReminder() {
  const { persistentReminders } = await chrome.storage.local.get("persistentReminders");

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
      requireInteraction: persistentReminders === true,
    },
    () => {
      // If Chrome couldn't create the notification, say why.
      if (chrome.runtime.lastError) {
        console.error("[background] notification failed:", chrome.runtime.lastError.message);
      }
    }
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "background") return;

  switch (message.type) {
    case "TOO_CLOSE_DETECTED":
      showReminder();
      // TODO (step 3): log a `reminder_shown` analytics event here.
      break;

    case "BACK_AT_SAFE_DISTANCE":
      chrome.notifications.clear(REMINDER_NOTIFICATION_ID);
      // TODO (step 3): log a `reminder_resolved` analytics event here.
      break;

    default:
      break;
  }

  sendResponse({ ok: true });
});