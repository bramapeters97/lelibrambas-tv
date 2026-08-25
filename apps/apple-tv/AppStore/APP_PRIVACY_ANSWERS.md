# App Privacy answers worksheet

This worksheet maps the implemented app/gateway behavior to App Store Connect. It is not legal advice and is not a final submission. The Account Holder must reconcile it with deployed Cloudflare settings, contracts, retention, support operations, and the exact production build before answering Apple.

## Tracking

- **Does this app use data for tracking?** Prepared answer: **No**.
- **Tracking domains:** None declared.
- Evidence: no advertising SDK, analytics SDK, cross-company profiling, IDFA use, or sale/sharing for targeted advertising exists in the native source.
- Manual gate: confirm Cloudflare and media providers are configured only as service processors and do not reuse data for tracking.

## Data transmitted or retained

| Apple data category candidate                               | Actual behavior                                                                                                                                                                                                                           | Linked to identity?               | Purpose                                       | Prepared direction                                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Contact Info — Email Address                                | Cloudflare Access verifies email in the browser. Gateway compares an email hash allowlist and stores a masked email hint with authorization/session records. The optional hint can be returned to Apple TV.                               | Yes                               | App Functionality, account access             | Disclose as collected unless production is changed and counsel confirms otherwise                   |
| Identifiers — User ID                                       | Gateway stores a SHA-256 subject hash and opaque hashed session identifiers. Raw session token is returned once and stored in device Keychain.                                                                                            | Yes                               | Authentication, security, App Functionality   | Likely disclose as collected                                                                        |
| Identifiers — Device ID                                     | App submits the generic label `Apple TV`; it does not use IDFA or read a hardware advertising/device identifier. Authorization codes identify one activation transaction.                                                                 | Possibly                          | Authentication/security                       | Confirm Apple’s current definition; do not claim hardware device-ID collection                      |
| Usage Data — Product Interaction/Other Usage                | Gateway updates session `last_seen_at` and rate-limit counters when authenticated endpoints are used. It does not implement watch history, analytics events, or per-title viewing records.                                                | Session-linked                    | Security, fraud prevention, App Functionality | Confirm whether operational last-seen/rate limiting must be disclosed                               |
| Diagnostics                                                 | App logs only redacted categories locally. Cloudflare observability is enabled for Worker logs and sampled traces; code logs request ID, method, path, and error type on unexpected failures. Hosting may process IP/user-agent metadata. | Not linked by application code; provider behavior needs confirmation | App Functionality, diagnostics, security      | Other Diagnostic Data is declared conservatively; review Cloudflare fields/retention and add linkage, Crash, or Performance disclosures if retained |
| User Content — Photos/Videos                                | The app receives catalog metadata, artwork, and video for viewing. It provides no uploads and does not collect a user’s local photos/videos.                                                                                              | N/A                               | Content delivery                              | Do not mark user-content collection solely because the app streams server media                     |
| Purchases/Financial/Location/Contacts/Health/Sensitive Info | No corresponding native functionality is implemented.                                                                                                                                                                                     | N/A                               | N/A                                           | Prepared answer: not collected, subject to final service audit                                      |

## Retention/security evidence

- Device/user codes and session tokens are stored as hashes in D1; authorization and expired session rows are deleted after an additional one-day cleanup window in current gateway code.
- Session TTL is configured up to 30 days; production value must be confirmed.
- Rate-limit keys are hashed and deleted after their window expires.
- Apple TV stores the scoped expiring session in a this-device-only Keychain item and clears it on logout/expiry.
- Network transport is HTTPS only; no broad ATS exception exists.
- The native Privacy Manifest declares no tracking or tracking domains. It declares linked Email Address, User ID, and Product Interaction data plus unlinked Other Diagnostic Data, all for App Functionality. It declares no required-reason API category because the native source uses first-party network/Keychain APIs and no covered third-party SDK. The manifest must remain consistent with the final App Store Connect server-side disclosures; it does **not** replace them.

## Final owner/provider questions

- What request/IP/user-agent fields do Cloudflare logs and traces retain, in which region, and for how long?
- Are media-host requests logged and linked to signed URLs/accounts?
- Can support staff access masked email/session records, and under what deletion procedure?
- Is a privacy/contact request channel operational at the public support URL?
- Are all listed processors and purposes reflected in the final privacy policy?

Do not submit until every row has a documented yes/no decision and the published privacy policy matches it.
