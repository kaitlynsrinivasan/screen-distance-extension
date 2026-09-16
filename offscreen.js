// offscreen.js — runs inside the invisible offscreen document.
//
// This is where the actual webcam access and face-detection loop will live.
// Left as a skeleton for now — we'll fill this in during step 2 (face
// detection + distance estimation).
//
// Permission note: Chrome's camera permission prompt has to be triggered by
// a user gesture on a visible page. This offscreen document has no user-
// facing UI, so it can't request permission itself. Instead, popup.js has a
// "Grant camera access" button that calls getUserMedia once — permission is
// then remembered for this extension's origin (chrome-extension://<id>), and
// this offscreen document can reuse it silently afterward.

const video = document.getElementById("video");

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();
    console.log("[offscreen] camera stream started");
    // TODO (step 2): start the face-detection loop here.
  } catch (err) {
    console.error("[offscreen] camera access failed:", err);
    // Likely means the user hasn't granted permission yet via the popup.
  }
}

startCamera();
