# Export compliance worksheet

The native app uses Apple’s URL Loading System/TLS for HTTPS video playback and system media frameworks. It implements no proprietary encryption algorithm, VPN, secure-messaging product, cryptocurrency feature, account system, or authentication gateway.

This technical inventory often supports an exempt/non-proprietary encryption position, but the repository does not make a legal export declaration. Before upload, the Account Holder must:

1. Review Apple’s current export-compliance questions and applicable U.S./local requirements.
2. Confirm no dependency, entitlement, media DRM integration, or production service adds non-exempt encryption.
3. Determine whether `ITSAppUsesNonExemptEncryption` should be `NO`, or whether documentation/annual self-classification is required.
4. Keep the determination and any classification paperwork with release records.
5. Answer App Store Connect consistently with the binary; do not copy a prior app’s answer blindly.

If the implementation changes to custom cryptography, end-to-end encrypted communications, VPN/security tooling, or third-party DRM, repeat the assessment before the next upload.
