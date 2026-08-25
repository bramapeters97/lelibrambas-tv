# App Review notes draft

Replace all placeholders and test the complete path immediately before submission.

LeliBrambas+ is a native tvOS viewer for a limited, private family film archive. It is not a web wrapper. The app uses SwiftUI for browsing and AVKit for playback. There are no purchases, subscriptions, advertising, public uploads, user-generated-content posting, or social features in this release.

Access remains required even if the app is reached through an unlisted App Store link. On first launch the Apple TV displays a short-lived device code and QR/HTTPS activation address. The reviewer completes activation in a separate browser, then the TV receives a scoped expiring session. Expiry or sign-out returns to activation.

## Review access

- Activation URL: `<PRODUCTION_ACTIVATION_URL>`
- Dedicated reviewer email/account: `<REVIEWER_ACCOUNT>`
- Temporary PIN/password delivery: `<APP_STORE_CONNECT_SECURE_REVIEW_FIELD_ONLY>`
- Review-account expiry: `<DATE_AFTER_EXPECTED_REVIEW_WINDOW>`
- Contact during review: `<NAME, PHONE, EMAIL>`

Do not paste secrets into this Markdown file. Store usable review credentials only in App Store Connect’s review information.

## Test path

1. Launch LeliBrambas+ and select **Activate Apple TV**.
2. Open the displayed URL or QR code in a browser.
3. Sign in with the dedicated reviewer account and approve the displayed TV code.
4. Wait for Home to load. Browse a shelf or Search, select any explicitly review-cleared synthetic/licensed title, and open details.
5. Select Play. Test native controls and return with Menu/Back.
6. Open Settings to sign out.

The submitted review account must expose enough rights-cleared content to exercise browsing and playback without revealing unrelated private media. The owner must confirm distribution/streaming rights for every title visible to review.
