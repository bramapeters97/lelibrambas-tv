# App Store Connect record setup

Create this record manually; no repository script creates or mutates App Store Connect resources.

| Field                             | Prepared value                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| Platforms                         | tvOS                                                                               |
| Name                              | LeliBrambas+                                                                       |
| Primary language                  | Dutch (Netherlands) if the owner approves the Dutch copy; otherwise English (U.S.) |
| Bundle ID                         | Explicit App ID `com.lelibrambas.plus`                                             |
| SKU                               | Suggested: `LELIBRAMBAS-PLUS-TVOS-001` (internal, immutable after creation)        |
| Version                           | 1.0.0                                                                              |
| Primary category                  | Entertainment                                                                      |
| Secondary category                | Photo & Video, only if App Store Connect offers it and the owner agrees            |
| Copyright                         | `© <YEAR> <LEGAL RIGHTS-HOLDER NAME>`                                             |
| Price                             | Free, if the owner confirms there are no charges/subscriptions                     |
| Distribution method at submission | Public; request unlisted distribution separately                                   |

## Before clicking Create

- Confirm `com.lelibrambas.plus` is available and intentionally differs from any older Expo/prototype identifier.
- Confirm the same App Store Connect record should later receive iOS/iPadOS platforms. Adding those platforms does not require a `.tvos` suffix, but their future app must use the same app identity strategy approved by the owner.
- Confirm app name availability, legal entity, tax/agreements, and role permissions.
- Record the resulting numeric Apple ID privately; do not commit it unless repository policy later permits a non-secret identifier.

## Required submission material

- Reviewed English/Dutch metadata, 1–10 compliant tvOS screenshots, final app icon and top-shelf assets.
- Public HTTPS support URL and privacy-policy URL. Draft page content exists in this directory, but nothing is deployed.
- App Review contact and the no-login review path from `APP_REVIEW_NOTES.md`.
- Complete App Privacy answers, age rating, export-compliance decision, content-rights declaration, pricing, territories, and release option.
- A processed signed build whose bundle ID/version/build match the record.

Apple requires the app record before build upload; consult the current [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow) on submission day.
