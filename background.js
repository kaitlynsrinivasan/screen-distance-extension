// background.js — Manifest V3 service worker
//
// Why this file is small: MV3 service workers can be killed and restarted by
// Chrome at any time and have no DOM access, so they can't touch getUserMedia
// or run face-detection code directly. This file's only jobs are:
//   1. Keep an "offscreen document" alive to do the actual camera/ML work
//      (offscreen.js) — see the architecture note in README.md.
//   2. Relay messages from the offscreen document into user-visible things
//      (native notifications) and, later, analytics events.

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

// Ensures exactly one offscreen document exists. Safe to call repeatedly.
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["USER_MEDIA"],
    justification: "Access webcam to estimate distance from screen via on-device face detection.",
  });
}

// Create the offscreen document as soon as the extension starts up.
chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
});
chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreenDocument();
});

// Messages coming from offscreen.js (the face-detection loop).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "background") return;

  switch (message.type) {
    case "TOO_CLOSE_DETECTED":
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "You're sitting close to the screen",
        message: "Try scooting back a bit.",
        priority: 1,
      });
      // TODO (step 3): log a `reminder_shown` analytics event here, and
      // start the "did they move back?" timer described in the spec.
      break;

    case "STATUS_UPDATE":
      // TODO (step 3): forward periodic status to analytics as needed.
      break;

    default:
      break;
  }

  sendResponse({ ok: true });
});
