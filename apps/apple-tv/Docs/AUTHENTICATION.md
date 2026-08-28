# Authentication

The tvOS application intentionally has no authentication or activation layer. It requests the public movies catalogue at startup, loads public HTTPS poster artwork as needed, and uses the bundled catalogue and generic poster when those requests fail. AVPlayer loads the selected preview or movie directly from its public stream source.

Do not add gateway endpoints, device codes, polling, accounts, sessions, tokens, Keychain credentials, or Cloudflare Access dependencies to the production tvOS path.
