# Resume bullets (draft)

Written now, in advance, so the project gets built to produce these
specific numbers rather than backfilling a description after the fact.
Fill in every `[X]` with real data before using — see the "honesty" note
at the bottom.

## SWE-focused (primary — use these on a software engineering resume)

- Built a Chrome extension (Manifest V3, JavaScript, on-device ML) that
  estimates webcam-to-screen distance in real time via face detection and
  alerts users through native OS notifications, with all video processed
  entirely client-side.
- Architected the extension around Chrome's offscreen document API to run
  camera access and ML inference outside the service worker's restricted
  context, avoiding broad host permissions and content-script injection
  into arbitrary websites.
- Instrumented product analytics (PostHog) across [5] custom events without
  a custom backend, enabling retention and funnel analysis from day one.
- Shipped to the Chrome Web Store and grew to [XXX] installs across [N]
  weeks through organic distribution (Reddit, Product Hunt); achieved [XX]%
  7-day retention.
- Designed and ran an A/B test comparing [two notification strategies]
  across [XXX] users, improving [7-day retention / reminder-response rate]
  by [XX]%, and shipped the winning variant.

## APM-flavored variants (use if tailoring for a product-adjacent role)

- Scoped a 0-to-1 product from an unvalidated idea to a shipped MVP in [N]
  weeks, using MoSCoW prioritization to cut [X] non-essential features and
  ship a [3]-feature v1.
- Defined success metrics (7-day retention, reminder-to-action rate) before
  writing feature code, and instrumented analytics against them from the
  first build.
- Ran a controlled experiment on [notification framing] with [XXX] users,
  translating a [XX]% metric lift into a shipped default.

## Notes for filling these in
- **Installs/users:** pull from the Chrome Web Store developer dashboard.
- **Retention:** PostHog's retention chart, once you have 2+ weeks of data.
- **A/B test result:** PostHog funnel/trend comparison between the two
  `assigned_variant` cohorts (built in step 3).
- If a number underperforms your hope (e.g., 40 installs, not 400), that's
  still a usable, honest bullet — "identified low conversion from initial
  channel, tested a second channel" is a real story. Never round up or
  estimate a number you don't actually have; it's the first thing an
  interviewer will ask you to defend.
