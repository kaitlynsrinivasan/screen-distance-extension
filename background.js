// background.js — Manifest V3 service worker
//
// Since camera work now happens in monitor.js (a real window), this file
// goes back to being a pure dispatcher: it listens for messages from
// monitor.js and turns them into native OS notifications. It no longer
// needs to create or manage an offscreen document.

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