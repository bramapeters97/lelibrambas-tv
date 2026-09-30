import SwiftUI
import LeliBrambasCore

/// One preview belongs to the visible hero or detail context, never to a poster card.
struct MobilePreviewArtwork: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let item: MediaItem
    let isActive: Bool
    let delay: UInt64
    let startSeconds: Double
    @State private var isVisible = false
    @State private var isPaused = false
    @State private var previewURL: URL?
    @State private var isPlaying = false

    private var shouldPreview: Bool {
#if DEBUG
        if DebugLaunchOptions.fixtureMode { return false }
#endif
        return isVisible && isActive && scenePhase == .active && !reduceMotion
            && !isPaused && MobileCatalogue.canPlay(item)
    }

    var body: some View {
        MobileArtwork(item: item, backdrop: true)
            .opacity(isPlaying ? 0 : 1)
            .overlay {
                if let previewURL {
                    LBMutedPreview(url: previewURL, targetStartSeconds: startSeconds,
                                   onPlaying: { isPlaying = true },
                                   onStopped: { stop() })
                        .opacity(isPlaying ? 1 : 0)
                        .id(previewURL)
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if MobileCatalogue.canPlay(item) && !reduceMotion {
                    Button {
                        isPaused.toggle()
                    } label: {
                        Image(systemName: isPaused ? "play.fill" : "pause.fill")
                            .frame(width: 44, height: 44)
                            .background(.black.opacity(0.75), in: Circle())
                    }
                    .foregroundStyle(.white)
                    .padding(8)
                    .accessibilityLabel(isPaused ? "Play muted preview" : "Pause preview")
                }
            }
            .clipped()
            .onAppear { isVisible = true }
            .onDisappear { isVisible = false; stop() }
            .task(id: PreviewRequest(movieID: item.id, enabled: shouldPreview)) {
                stop()
                guard shouldPreview else { return }
                do { try await Task.sleep(nanoseconds: delay) }
                catch { return }
                guard !Task.isCancelled, shouldPreview else { return }
                let url = await model.preparePreview(for: item)
                guard !Task.isCancelled, shouldPreview else { return }
                previewURL = url
            }
    }

    private func stop() {
        previewURL = nil
        isPlaying = false
    }

    private struct PreviewRequest: Equatable {
        let movieID: Int
        let enabled: Bool
    }
}
