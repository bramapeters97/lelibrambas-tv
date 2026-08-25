# Web-to-tvOS design parity matrix

The visual reference is the current React viewer in `apps/tv/src/App.tsx`, `Discovery.tsx`, and `styles.css`. Those web files remain unchanged. The Apple TV implementation adapts that established design to native SwiftUI focus, safe areas, and Siri Remote interaction.

| Web experience | Native tvOS counterpart | Shared identity | Television adaptation |
| --- | --- | --- | --- |
| Three-profile intro | Session-local three-profile selector | Exact names, initials, colors, wordmark, background, rings, and copy | Large focus targets; selection is not authentication and can be switched from the navigation rail |
| Trailer hero | Native Home hero for `Lelibrambas+ Trailer` | Official studio art, EVENTS eyebrow, `LELIBRAMBAS+ Trailer`, 2026/EVENTS/EVENTS metadata, Play Trailer and More information | Focus-safe buttons and 1080p safe-area sizing |
| Horizontal movie rows | Native media shelves and grids | Exact 16:9 landscape crop, 10-point radius, dark copy surface, index, title, metadata, shadow | 1.045 focus scale with additional gaps to avoid collision |
| Four collection cards | Four-column native collection grid | Same order, gradient palettes, catalogue labels, counts, and large directory numbers | Wider outer margins and 32-point gaps for focus expansion |
| Left icon rail | Persistent native navigation rail | Exact web cinema mark, dark/navy rail, Home/Search/Collections/Library hierarchy, local profile initials | Focus expands labels; Settings remains available as a relevant native destination |
| Search and library | Native search and full library | Same typography, cards, loading, empty, and error language | Native text entry and focus navigation |
| Movie details | Native detail screen | Aspect-fill art/preview, heavy left and bottom gradients, gold eyebrow, title, metadata, synopsis, white Play action | Circular Back action and predictable Siri Remote dismissal |
| Ambient detail preview | Muted AVPlayer detail preview | One-second delay and 120-second target | Safely clamps for short media, cancels on exit, and respects Reduce Motion |
| Full playback | AVPlayerViewController | Selected item's exact `stream_video_id` and title | Native play/pause, scrubber, audio, fullscreen, Back, and +/-10-second actions; starts normally at zero |
| App icon and Top Shelf | Layered tvOS asset catalog | Official root `lelibrambas-studios.png` source | Center-cropped Apple-required sizes; transparent upper layers preserve the valid stack |

The web font stack starts with Segoe UI Variable/Segoe UI, but the repository contains no licensed font files. tvOS therefore uses the closest platform fallback, Apple system/SF Pro with its default design, while matching the web weights, tracking, casing, and hierarchy rather than using rounded system typography.
