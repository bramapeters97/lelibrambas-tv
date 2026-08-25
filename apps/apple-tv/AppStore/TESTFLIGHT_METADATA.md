# TestFlight metadata draft

Replace all angle-bracket placeholders before enabling testers.

**Beta app description**

Native Apple TV client for the access-controlled LeliBrambas+ family film archive. This beta validates device activation, catalog browsing, search, details, session restoration, and native video playback.

**Feedback email**

`<TESTFLIGHT_FEEDBACK_EMAIL>`

**What to Test**

1. Request activation and complete it from the displayed HTTPS URL/QR code.
2. Relaunch and confirm the valid session restores without another activation.
3. Browse Home and Collections; test long titles, empty states, loading, and Siri Remote focus order.
4. Search for an authorized catalog title and open its detail page.
5. Start playback; test play/pause, ±10-second seeking, scrubbing, audio, Back, and replay.
6. Test network loss, expired authorization, unavailable artwork/video, and sign-out.

Never include private title names, emails, session/device codes, or playback URLs in emailed feedback. Use the displayed redacted support reference if available.

**Login instructions for testers**

Use the activation code shown on Apple TV. Open `<PRODUCTION_ACTIVATION_URL>` on a separately signed-in browser and approve this device using the tester account supplied out of band. No credentials are embedded in the build.

**Known limitations to confirm/update**

- Requires internet access and a reachable production gateway/media service.
- No offline download or public account registration.
- The beta expires according to Apple’s TestFlight window.
- tvOS feedback is sent to the configured feedback email.

**Beta App Review notes**

Use the dedicated reviewer activation instructions from `APP_REVIEW_NOTES.md`; paste actual credentials only into App Store Connect’s protected review fields.
