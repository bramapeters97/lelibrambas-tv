# tvOS privacy policy draft

**Effective date:** `<EFFECTIVE_DATE>`

**Controller/legal entity:** `<LEGAL_ENTITY_OR_PERSON>`

**Contact:** `<PRIVACY_EMAIL_AND_POSTAL_CONTACT>`

This draft must be reconciled with `APP_PRIVACY_ANSWERS.md`, production Cloudflare/media-provider settings, and applicable law before publication.

## About LeliBrambas+

LeliBrambas+ is an access-controlled Apple TV viewer for a private family film archive. It is not an advertising service and does not provide public uploads, social sharing, purchases, or subscriptions.

## Information used

To decide whether access is allowed, the activation service processes the email identity authenticated through the configured access provider. The service stores a one-way identity hash and a masked email hint with short-lived device-authorization and session records. It also processes a generic device label, random authorization/session identifiers, expiry/status timestamps, session last-use time, and short-lived rate-limit counters.

When the app is used, the service returns authorized catalog metadata, artwork, and a playback address. The current application does not create analytics events or a viewing-history feature. Hosting and media providers may process network information such as IP address, user agent, request path, timing, and errors to deliver and protect the service; final provider fields and retention must be inserted here: `<PROVIDER_AND_RETENTION_DETAILS>`.

## Purposes

Information is used only to authenticate approved users/devices, deliver the requested archive and media, maintain session security, prevent abuse, troubleshoot failures, and meet legal obligations. It is not used for cross-app tracking or targeted advertising and is not sold.

## Storage and retention

The Apple TV stores the scoped expiring session in Apple Keychain storage restricted to that device. Logout and expiry clear local session state. The gateway stores authorization/session secrets only as hashes. Current code deletes expired authorization and session rows after an additional cleanup window of approximately one day and deletes rate-limit records after their window; production schedules and backups must be confirmed here: `<FINAL_RETENTION_AND_BACKUP_POLICY>`.

## Service providers and transfers

The app depends on Apple for app distribution/device services and on `<CLOUDFLARE_AND_MEDIA_PROVIDER_LEGAL_NAMES>` for access control, hosting, network delivery, storage, and streaming. Add processing locations, safeguards, and links to provider notices as required: `<TRANSFER_DETAILS>`.

## Choices and rights

Users may sign out in the app. To request access, correction, deletion, restriction, or other applicable privacy rights, contact `<PRIVACY_EMAIL>`. Explain identity verification, response timing, exceptions, and the complaint/supervisory-authority route required for the owner’s jurisdiction: `<RIGHTS_PROCESS>`.

## Children

The archive may contain family media, but account access is limited to approved users. The owner must add the legally reviewed children’s-privacy position appropriate to the audience and territories: `<CHILDREN_POLICY>`.

## Changes

Material policy changes will be reflected by updating the effective date and communicating them through `<NOTICE_METHOD>`.
