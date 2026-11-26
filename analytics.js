// analytics.js — sends product-analytics events to PostHog.
//
// Loaded into background.js with importScripts(), so `track` is available
// there. Only background.js sends analytics; other parts of the extension
// ask it to (via messages), which keeps all tracking in one place.
//
// The project API key below (it starts with "phc_") is meant to be public:
// it can only WRITE events, not read any data back, and it ships inside the
// extension anyway, so anyone could find it. A *personal* API key (starts
// with "phx_") is different and must never go in this repo.

const POSTHOG_KEY = "phc_w6ddypMH75n6PGmQjSxmQyNGkJt2ArEietB3zk6kQB7X";
// US cloud. If your PostHog project is in the EU region, use
// "https://eu.i.posthog.com" instead.
const POSTHOG_HOST = "https://us.i.posthog.com";

// Every install gets a random ID, created once and saved. It identifies an
// install, not a person: it isn't linked to a name, email, or anything else.
async function loadOrCreateAnonymousId() {
  const { anonymousId } = await chrome.storage.local.get("anonymousId");
  if (anonymousId) return anonymousId;

  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ anonymousId: newId });
  return newId;
}

// Several events can fire at nearly the same moment, and each would ask for
// the ID before the first one has finished saving it, creating two different
// IDs for one install (a race condition). Remembering the in-progress
// request, and having everyone share it, prevents that.
let anonymousIdPromise = null;
function getAnonymousId() {
  if (!anonymousIdPromise) {
    anonymousIdPromise = loadOrCreateAnonymousId();
  }
  return anonymousIdPromise;
}

// Sends one event to PostHog. Never throws: analytics should never be able to
// break the extension, so failures are only logged.
async function track(eventName, properties = {}) {
  if (POSTHOG_KEY.startsWith("PASTE_")) {
    console.warn("[analytics] no PostHog key set yet; skipping event:", eventName);
    return;
  }

  try {
    const distinctId = await getAnonymousId();
    const response = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: eventName,
        distinct_id: distinctId,
        properties: {
          ...properties,
          extension_version: chrome.runtime.getManifest().version,
        },
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      console.log("[analytics] sent:", eventName);
    } else {
      console.error("[analytics] PostHog rejected the event:", response.status);
    }
  } catch (err) {
    console.error("[analytics] couldn't send event:", err);
  }
}