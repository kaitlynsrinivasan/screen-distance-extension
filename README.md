# Screen Distance Reminder

A Chrome extension that estimates how close you are to your screen using
on-device webcam face detection, and nudges you with a native notification
when you're too close for too long. No video frame ever leaves your device.

## Status
🚧 Step 2 in progress: face detection pipeline runs continuously (checking
distance roughly once per second). The core loop works end-to-end; it 
detects sustained closeness and sends a native notification. 

## Architecture

**The core constraint:** Manifest V3 service workers (`background.js`) have
no DOM and are killed/restarted by Chrome at will, so they can't call
`getUserMedia()` or run a face-detection loop directly.

**First attempt (abandoned):** an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
(`offscreen.html` / `offscreen.js`) — a hidden page Chrome keeps alive for
tasks like camera access that need a real DOM, without opening a visible
window. This is the officially documented pattern for this kind of problem,
but in practice it hit a real, under-documented Chrome limitation: camera
permission granted elsewhere in the extension did not reliably carry over
into the offscreen document's context, consistently failing with
`NotAllowedError: Permission dismissed` even after permission was properly
granted via a real, visible tab. This wasn't unique to this project — other
developers have reported the identical failure for both camera and
microphone access in offscreen documents. Since we can't ship an extension
that requires end users to manually override a hidden Chrome settings page
just to make the camera work, this approach was scrapped rather than
worked around.

**Current design:** camera access and face detection run inside
`monitor.html` / `monitor.js` — a small, real, visible extension window
(opened via `chrome.windows.create`) rather than a hidden offscreen
document. A normal window doesn't have the permission-persistence problem:
the first time it opens, it shows a "Grant camera access" button (a real
click, which the browser's permission system requires); every time after
that, Chrome silently reuses the granted permission, the same way it does
for any website you've already allowed. The trade-off, stated plainly: this
window needs to stay open (it can be minimized) for monitoring to keep
running — it's no longer a fully invisible background process the way the
offscreen approach would have been if it had worked.

```
popup.js  --(chrome.windows.create)-->  opens monitor.html
                    |
                    v
monitor.js  --(camera stream + face detection loop, step 2)-->
                    |  chrome.runtime.sendMessage: "TOO_CLOSE_DETECTED"
                    v
background.js  --(chrome.notifications.create)-->  native OS notification
```

**Alternative also considered, earlier:** inject a banner directly into every open tab via
a content script. Rejected because (a) it requires broad host permissions,
which slows Chrome Web Store review and looks scarier in the install
prompt, and (b) arbitrary sites' CSPs can interfere with injected UI.
Native notifications are also less intrusive by default, which fits the
"gentle nudge" product goal better than a banner across whatever the user
is looking at.

## Privacy
Camera frames are processed entirely on-device and are never transmitted,
stored, or sent to any server. Only lightweight usage events (see the
analytics plan, step 3) are logged for product analytics — never video or
images.

## Local development
1. `chrome://extensions` → enable "Developer mode" → "Load unpacked" → select this folder.
2. Click the extension icon, then click the button to open the monitoring window.
3. In that window, click "Grant camera access" the first time; it's remembered after that.

## Troubleshooting

**I'm not seeing reminder notifications.** Notifications have to be allowed
at the operating-system level, not just in Chrome. On macOS: open System
Settings → Notifications → Google Chrome and turn on "Allow notifications".
Also check that Focus / Do Not Disturb isn't on, since it silently hides
notifications.

**I want reminders to stay on screen until I move back.** Turn on
"Persistent reminders" in the extension's popup. On macOS this needs one
extra step: System Settings → Notifications may list Google Chrome twice
(one entry for temporary notifications, one for persistent ones). Make sure
"Allow notifications" is on for both. If persistent reminders are on and
you see nothing at all, the persistent entry is the likely culprit.

## Roadmap
- [x] Step 1: project scaffolding, manifest, popup UI
- [x] Step 2a: face-api.js integrated, single-frame detection confirmed working
- [x] Step 2b: continuous detection loop (checks distance every ~1s)
- [x] Step 2c: calibration (save a personal baseline distance)
- [x] Step 2d: sustained-closeness detection (avoid false alarms from one flickery frame)
- [x] Step 2e: native reminder notification, cleared when the user moves back
- [ ] Step 3: PostHog analytics wiring (5 events from the spec)
- [ ] Step 4: popup settings wired up
  - [x] Opt-in persistent reminders setting
  - [ ] "Reminders on" toggle pauses and resumes monitoring
  - [ ] Sensitivity setting
  - [ ] Daily reminder count
- [ ] Step 5: Chrome Web Store listing + launch
- [ ] Step 6: A/B test on reminder style, analyze, ship winner
