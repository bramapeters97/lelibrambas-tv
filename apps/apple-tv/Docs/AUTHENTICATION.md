# Authentication

The tvOS application intentionally has no authentication or activation layer. It requests the public movies catalogue at startup and loads each public HTTPS poster URL as needed. Catalogue failure uses the existing retryable error state, and failed poster artwork uses the code-rendered card placeholder. AVPlayer loads the selected preview or movie directly from its public stream source.

Do not add gateway endpoints, device codes, polling, accounts, sessions, tokens, Keychain credentials, or Cloudflare Access dependencies to the production tvOS path.
