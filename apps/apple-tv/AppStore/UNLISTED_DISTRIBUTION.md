# Unlisted App Store distribution

Recommended long-term route: validate through TestFlight, pass normal App Review, then request Apple’s unlisted distribution for the limited family audience. Do not treat TestFlight as permanent distribution.

## Sequence

1. Complete metadata, privacy, rating, content-rights, support, review-access, screenshots, and a signed build.
2. In App Store Connect set distribution to **Public**, select deliberate territories/pricing, and choose manual release if the owner wants a final gate.
3. Add a Review Note that the app is intended for unlisted distribution.
4. Submit the final app/version to normal App Review. An app still only in beta/prerelease is not eligible for the unlisted request.
5. Submit Apple’s unlisted-app request using the reviewed draft in `UNLISTED_REQUEST_DRAFT.md`.
6. Wait for Apple’s decision; do not publish or distribute a link prematurely.
7. If approved, verify App Store Connect shows **Unlisted App** and test the generated direct link.
8. Share the direct link only through the intended private channel, while assuming it can be forwarded.

Apple states that unlisted apps do not appear in search, charts, categories, or recommendations, but anyone with the link can reach the store page. The current tvOS app has no in-app authentication, so the owner must accept that distribution risk. See [Apple’s unlisted distribution guidance](https://developer.apple.com/support/unlisted-app-distribution/) and [distribution-method instructions](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/set-distribution-methods).

Do not choose **Private** Apple Business/School Manager distribution for this route unless the intended audience is managed through those programs; Apple documents that switching private/public later can require a new app record.
