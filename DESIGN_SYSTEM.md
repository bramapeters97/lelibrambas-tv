# Lelibrambas Midnight Archive design system

The design aims for a calm, premium living-room archive: near-black/navy surfaces, restrained aurora blue and memory gold accents, large editorial type, synthetic cinematic art, and a clearly visible white focus state.

It is an original system. Do not introduce third-party entertainment-company names, logos, characters, castle/arc/star motifs, typography, sounds, screenshots, or copied layouts. The luminous `+` is a small archive marker, not an imitation of another studio treatment.

## Semantic tokens

`packages/design-system/src/index.ts` exports the intended semantic values:

| Token           | Value     | Use                                      |
| --------------- | --------- | ---------------------------------------- |
| `void`          | `#03050B` | Deepest TV/player background             |
| `midnight`      | `#070D1B` | Primary dark ground                      |
| `deepNavy`      | `#0B1427` | Layered background                       |
| `surface`       | `#111C33` | Cards and controls                       |
| `surfaceRaised` | `#172541` | Focused/elevated surface                 |
| `surfaceSoft`   | `#1C2C4B` | Secondary surface                        |
| `textPrimary`   | `#F7F9FE` | High-emphasis copy                       |
| `textSecondary` | `#C2CBDC` | Descriptions and metadata                |
| `textMuted`     | `#8793A9` | Low-emphasis copy                        |
| `aurora`        | `#70D8FF` | Brand plus, progress, interactive accent |
| `indigo`        | `#8275FF` | Secondary accent                         |
| `memoryGold`    | `#E9C778` | Archive eyebrow/heritage accent          |
| `focusWhite`    | `#FFFFFF` | TV focus ring                            |
| `success`       | `#72DDA6` | Ready/complete                           |
| `warning`       | `#F2C36B` | Review/processing                        |
| `error`         | `#FF8290` | Failure/unavailable                      |

Focus motion is `1.055` scale over `190ms` with `cubic-bezier(.2,.8,.2,1)`. Intended TV safe margins are `4.6%` horizontal and `4.4%` vertical.

The React DOM navigation rail is tokenized separately from the TV safe margin: `70px` on wider
screens and `56px` at the `800px` responsive boundary. Any pop-out/focus translation must derive
from the same CSS variables so reducing the rail never leaves stale content offsets.

The web CSS and native StyleSheet currently duplicate or closely mirror these constants rather than importing the package. Treat consolidation as future work; changing only the TypeScript token file does not automatically restyle every surface.

## Typography and layout

- Viewer: `Segoe UI Variable Display`, `Segoe UI`, then system sans-serif.
- Headlines use tight tracking and large scale; labels use uppercase, wider tracking, and short phrases.
- TV composition assumes 16:9, keeps key controls inside safe margins, and uses horizontal rails sized for remote scanning.
- Player media uses containment so legacy 4:3 stays pillarboxed rather than stretched.

## Focus and input

Every actionable TV element needs an obvious focused state that does not rely on colour alone. The web viewer uses a white outline, offset, scale, and elevation; the native tvOS shell uses `Pressable` focused styles and `TVFocusGuideView`. Spatial movement must be deterministic with arrow-key or directional remote input, and Back/Menu must return one logical level.

Do not place important actions behind hover, pointer gestures, or text entry alone. Keep focus targets large, avoid surprise focus jumps after async state changes, and retest at 1280x720 and 1920x1080.

## Motion

Motion establishes hierarchy, not spectacle. Use roughly 150-240ms for focus/control transitions and longer motion only for the studio ident or deliberate player overlays. `prefers-reduced-motion` collapses web animations and transitions. Native reduced-motion behavior is not yet implemented and must be considered before release.

Collection selection keeps selector order stable. The selected-card gradient lasts exactly one
second; result replacement uses a 350ms leave and 650ms enter/slide sequence. The homepage hero
keeps its checked-in LELIBRAMBAS studio-logo artwork at rest. After two idle seconds, a successfully
playing trailer cued at 40 seconds can fade into the same masked media bounds. Detail pages use the
same borderless treatment over their existing poster and cue at 120 seconds. Activity, scrolling,
rejected autoplay, ending, or leaving restores the resting artwork. Ambient transitions are disabled
in deterministic capture mode and never write watch progress.

## Artwork and privacy

Checked-in catalogue artwork and the hero logo use approved project PNGs; CSS palette geometry and
`generic_cinema_2.png` provide the fallback treatment. Card/detail artwork always travels through
the same `poster_url`/`resolvePosterUrl` path at every responsive breakpoint. Generated demo MP4s use
FFmpeg colour/geometric sources and silence. Do not substitute private photographs or captured
video frames in public screenshots. Production artwork belongs behind the media/catalogue
authorization boundary.

## Component conventions

- **Viewer hero:** near-black/deep-navy blended logo art, readable layered scrim, concise synopsis,
  valid metadata only, Play/Resume, More Information, and progress.
- **Navigation rail:** compact icons; reveal a label on focus without unexpectedly stealing focus from content.
- **Cards and hubs:** stable dimensions, unclipped focused scale, deterministic IDs, and an explicit missing-artwork fallback.
- **Responsive discovery:** compact horizontal rails; a one-row collection selector; exact
  two-column collection results and search at `<=800px`; mobile card taps play while a
  separate sibling information action preserves Details.
- **Player:** minimal near-black controls, original-aspect language, deliberate 4:3 pillarboxing, and retryable error/up-next states.

Success, warning, and error colours must always be paired with readable text or iconography. Do not imply that conversion/upload completed merely through optimistic colour or copy.

## Accessibility checklist

- Preserve semantic buttons, headings, labels, and visible `:focus-visible` rings.
- Maintain readable contrast for muted copy and status chips; status also needs text, not colour alone.
- Respect reduced motion and avoid flashing effects.
- Test 200% browser zoom and living-room distance for viewer surfaces.
- Caption/subtitle selection is not implemented end to end; do not claim accessibility parity until native/web playback controls and converted subtitle handling are added and tested.
