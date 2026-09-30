# Three native iPhone versions

Three independently installable iOS 17+ apps share the same SwiftUI features,
live catalogue, stream resolver, profiles and local playback progress. Each
bundle stores its own progress so comparing versions does not overwrite another.

| Scheme | Presentation | Bundle identifier |
| --- | --- | --- |
| LeliBrambasClassic | Hero artwork above text, horizontal shelves, two-column grids | com.lelibrambas.plus.classic |
| LeliBrambasCinema | Edge-to-edge hero artwork, wide shelves, larger catalogue cards | com.lelibrambas.plus.cinema |
| LeliBrambasCompact | Small artwork beside the hero text, dense catalogue grids | com.lelibrambas.plus.compact |

Accessibility text switches to wider columns and lets titles wrap. Compact uses
a stacked hero at accessibility sizes. Four native tabs retain independent
navigation stacks. Search uses the system search field. Changing profiles clears
navigation into the previous profile. The existing native app uses local profiles
and a public catalogue, so no account-login service is introduced.

## Build and run

On a Mac with Xcode and iOS Simulator runtimes:

~~~sh
cd apps/apple-tv
bash MobileTools/generate-project.sh
open LeliBrambasMobile.xcodeproj
~~~

Choose a scheme and iPhone Simulator. Generation uses the repository's pinned,
checksum-verified XcodeGen 2.46.0. The separate project-ios.yml preserves the
existing TV project's platform settings, schemes, generated project and release
scripts. All three versions use the existing 1024-pixel cinema app icon.

~~~sh
bash MobileTools/test.sh LeliBrambasClassic
bash MobileTools/test.sh LeliBrambasCinema
bash MobileTools/test.sh LeliBrambasCompact
~~~

Each command runs unit/UI tests on a smaller iPhone, UI tests on a larger iPhone,
and an unsigned Release build. Use fresh result paths for another run;
xcodebuild does not overwrite existing xcresult bundles. UI tests use only the
existing synthetic debug catalogue. Screenshots are xcresult attachments.
Release uses the production catalogue loader and excludes fixture definitions.

## Shared code

- LeliBrambasCore: MediaItem, category organization and playback URL validation.
- AppModel and PlaybackProgressStore: catalogue state, playback sessions, resume,
  watched state and per-profile progress.
- MoviesAPICatalogLoader: the existing endpoint and transport. iOS opts into
  editorial metadata: featured, available, priority, backdrop, duration and
  preview offset. The default TV mapping is unchanged.
- ViewerProfile and LBTheme: existing profiles and brand colours.
- LBRemoteArtwork: existing HTTPS loader/cache, with optional downsampling for
  decoded iPhone images. Source URLs remain unchanged.
- LBMutedPreview, LBMediaPreviewTiming and LBPreviewPolicy: preview rendering,
  timing and cleanup. Detail artwork holds for three seconds.
- PlayerController: existing native player lifecycle and progress persistence.
- LBContentSelection and LBSearchIndex: existing hero selection and search.

PlayerScreen, MediaDetailView, SearchView and LBMediaComponents wrap their TV
presentation in os(tvOS) guards. Their reusable types compile into both
projects without copying those implementations or changing TV focus behavior.
Mobile uses AVPlayerViewController controls, AirPlay, Picture in Picture
configuration and the playback audio session.

Mobile uses the web's descending priority order, preserving source order for
ties. Priority -1 and unavailable films remain browsable but cannot start
previews or movies. Related titles follow the TV rule: up to four other films
in the same category, stable during the current detail visit.

Web, backend, schema, existing content and dependency pins are unchanged. The
pre-existing core test's flattened category expectation was corrected to match
its fixtures; a separate test now verifies source order within one category.
The production sorting implementation is unchanged.

## Validation and acceptance

The existing native CI workflow now has three iOS matrix jobs. Each saves the
generated project, logs and test results. A separate compatibility job tests the
shared package and builds/tests the committed TV project without regenerating it.
The original TV build/test job is retained. Its project-generation check currently
reports pre-existing drift between project.yml and the committed project's signing
settings, version and file identifiers. Resolving that drift requires reconciling
the existing release configuration; the mobile work does not overwrite it.
This Windows host cannot run Xcode or Simulator locally. Configured checks
are not evidence that a native build passed; consult the actual CI results.

Before release, test real streams, seeking, interruptions, background audio,
PiP restoration, AirPlay, rotation, VoiceOver and network failures on an iPhone.
Verify that previews release when changing tabs, pushing another film,
presenting full playback, scrolling artwork away and backgrounding the app.
Signing, TestFlight submission and deployment are separate from this change.

References: repository mobile CSS and catalogue behavior,
[Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars),
[Apple search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields),
[AVPlayerViewController](https://developer.apple.com/documentation/avkit/avplayerviewcontroller).
