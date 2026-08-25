# Authentication

The tvOS application intentionally has no authentication or activation layer. It loads its catalogue and artwork from bundled app resources and requests the network only when AVPlayer loads a selected preview or movie.

Do not add gateway endpoints, device codes, polling, accounts, sessions, tokens, Keychain credentials, or Cloudflare Access dependencies to the production tvOS path.
