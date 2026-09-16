# Screen Distance Reminder

A Chrome extension that estimates how close you are to your screen using
on-device webcam face detection, and nudges you with a native notification
when you're too close for too long. No video frame ever leaves your device.

## Status
🚧 Step 1 of build: project scaffolding + architecture in place. Face
detection and distance estimation land in step 2.

## Architecture

**The core constraint:** Manifest V3 service workers (`background.js`) have
no DOM and are killed/restarted by Chrome at will, so they can't call
`getUserMedia()` or run a face-detection loop directly.

**The solution:** an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
(`offscreen.html` / `offscreen.js`) — a hidden page Chrome keeps alive
specifically for tasks like camera access that need a real DOM. It runs the
camera stream and (in step 2) the face-detection loop, then messages
`background.js` when the user is too close. `background.js` turns that into
a native OS notification via `chrome.notifications`.

```
popup.js  --(one-time getUserMedia prompt for permission)-->  browser
                    |
                    v
offscreen.js  --(camera stream + face detection loop, step 2)-->
                    |  postMessage: "TOO_CLOSE_DETECTED"
                    v
background.js  --(chrome.notifications.create)-->  native OS notification
```

**Alternative considered:** inject a banner directly into every open tab via
a content script. Rejected because (a) it requires broad host permissions,
which slows Chrome Web Store review and looks scarier in the install
prompt, and (b) arbitrary sites' CSPs can interfere with injected UI.
Native notifications are also less intrusive by default, which fits the
"gentle nudge" product goal better than a banner across whatever the user
is looking at.

## Privacy
Camera frames are processed entirely on-device and are never transmitted,
stored, or sent to any server. Only lightweight usage events (see
`RESUME-BULLETS.md` / analytics plan) are logged for product analytics —
never video or images.

## Local development
1. `chrome://extensions` → enable "Developer mode" → "Load unpacked" → select this folder.
2. Click the extension icon, then "Grant camera access" to trigger the permission prompt.

## Roadmap
- [x] Step 1: project scaffolding, manifest, offscreen architecture
- [ ] Step 2: face detection + distance estimation + calibration
- [ ] Step 3: PostHog analytics wiring (5 events from the spec)
- [ ] Step 4: sensitivity setting + daily summary wired up fully
- [ ] Step 5: Chrome Web Store listing + launch
- [ ] Step 6: A/B test on reminder style, analyze, ship winner
