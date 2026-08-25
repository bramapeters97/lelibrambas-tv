# Native tvOS integration contract

## Device authorization

Create a challenge with:

```http
POST /v1/device/authorizations
Content-Type: application/json

{"deviceName":"Living Room Apple TV"}
```

The response fields are `device_code`, `user_code`, `verification_url`, `verification_url_complete`, `expires_at`, and `interval_seconds`. The Apple TV shows the short code, plain activation URL, and a QR code generated locally from `verification_url_complete`.

Poll no faster than `interval_seconds`:

```http
GET /v1/device/authorizations/{device_code}
```

Possible `data.status` values are `pending`, `approved`, `denied`, and `expired`. Only the first successful approved response contains `session_token`, masked `email`, and session `expires_at`. Treat `410 DEVICE_CODE_USED` as terminal and `429` according to `Retry-After`.

Persist the app-specific token in the tvOS Keychain with a this-device-only accessibility class. It is not a Cloudflare Access token.

## Catalog

Send the app session as `Authorization: Bearer …` to `GET /v1/catalog`. The response is compatible with the native `MediaItem` decoder:

```json
{
  "data": [
    {
      "id": 101,
      "title": "Synthetic Journey",
      "year": 2024,
      "description": "Synthetic example only.",
      "category": "OTHERS",
      "poster_url": "https://gateway.example.invalid/v1/artwork/101/poster?expires=…&sig=…",
      "backdrop_url": null,
      "sort_order": 1,
      "featured": true,
      "preview_start_seconds": 0
    }
  ]
}
```

The gateway deliberately strips `stream_video_id` and upstream credentials. Relative artwork referenced by the web catalog becomes a short-lived signed gateway URL so native image loading does not need a browser cookie.

## Playback

Call `POST /v1/media/{id}/playback` with the bearer session. The response is:

```json
{ "data": { "playback_url": "https://allow-listed-media-host.invalid/asset/manifest/video.m3u8" } }
```

If the catalog provides `playback_asset_id`, the gateway calls the existing upstream's exact `/api/media/{asset}/playback` route with HLS and the server-side credential. Otherwise it converts the existing Cloudflare Stream `/watch` or `/iframe` URL to the native HLS manifest form. It does not accept a URL in the request body.

## Session lifecycle

An expired or revoked token receives `401 SESSION_EXPIRED`; clear Keychain state and restart device authorization. `POST /v1/sessions/refresh` returns a replacement and immediately revokes the old token. `DELETE /v1/sessions/current` revokes the current token during logout.

The current Swift client can use the initial token until its explicit expiry. Rotation is available for a future background refresh policy; it is intentionally not performed implicitly in a response header that older clients could ignore.
