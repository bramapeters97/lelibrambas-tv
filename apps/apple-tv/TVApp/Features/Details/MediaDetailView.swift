import LeliBrambasCore
import SwiftUI

enum LBPreviewPolicy {
    static let delayNanoseconds: UInt64 = 1_000_000_000
    static let delaySeconds: Double = 1
    static let targetStartSeconds: Double = 120

    static func startSeconds(for durationSeconds: Double?) -> Double {
        LBMediaPreviewTiming.startSeconds(
            target: targetStartSeconds,
            durationSeconds: durationSeconds
        )
    }
}

struct MediaDetailView: View {
    private enum FocusTarget: Hashable {
        case play
        case restart
        case back
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    let item: MediaItem
    @ObservedObject var model: AppModel
    let profile: ViewerProfile
    @ObservedObject var progressStore: PlaybackProgressStore
    let isPreparingPlayback: Bool
    let focusScope: Namespace.ID
    let onPlay: (MediaItem, Double) -> Void

    @State private var previewURL: URL?
    @State private var previewIsPlaying = false
    @State private var previewRequestGeneration = 0
    @FocusState private var focusedAction: FocusTarget?

    var body: some View {
        ZStack(alignment: .topLeading) {
            backdrop
                .saturation(0.9)
                .brightness(-0.08)
                .opacity(0.72)

            LinearGradient(
                stops: [
                    .init(color: LBColor.canvas, location: 0),
                    .init(color: LBColor.canvas.opacity(0.95), location: 0.27),
                    .init(color: LBColor.canvas.opacity(0.58), location: 0.58),
                    .init(color: .clear, location: 0.8),
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            LinearGradient(
                colors: [.clear, LBColor.canvas.opacity(0.35), LBColor.canvas.opacity(0.94)],
                startPoint: .top,
                endPoint: .bottom
            )

            DetailBackButton { dismiss() }
                .padding(.leading, LBSpacing.safeHorizontal)
                .padding(.top, LBSpacing.safeVertical)
                .focused($focusedAction, equals: .back)

            VStack(alignment: .leading, spacing: 0) {
                Spacer()

                Text("LELIBRAMBAS+ CATALOGUE")
                    .font(LBTypography.eyebrow(size: 16))
                    .tracking(4.2)
                    .foregroundStyle(LBColor.gold)
                    .padding(.bottom, 15)

                Text(item.title)
                    .font(LBTypography.display(size: 62, weight: .heavy))
                    .foregroundStyle(LBColor.text)
                    .lineLimit(2)
                    .minimumScaleFactor(0.72)
                    .frame(maxWidth: 850, alignment: .leading)
                    .accessibilityIdentifier("details-title")

                Text([item.category, item.year.map(String.init)].compactMap { $0 }.joined(separator: " - "))
                    .font(LBTypography.title(size: 23, weight: .semibold))
                    .foregroundStyle(LBColor.gold)
                    .padding(.top, 13)

                LBMetadataRow(
                    values: [item.year.map(String.init), item.category, "16:9"].compactMap { $0 }
                )
                .padding(.top, 17)

                Text(item.description.isEmpty ? "No description is available for this film." : item.description)
                    .font(LBTypography.body(size: 23))
                    .foregroundStyle(LBColor.textSecondary)
                    .lineSpacing(7)
                    .lineLimit(5)
                    .frame(maxWidth: 820, alignment: .leading)
                    .padding(.top, 20)

                if let progress = resumableProgress {
                    VStack(alignment: .leading, spacing: 11) {
                        GeometryReader { proxy in
                            ZStack(alignment: .leading) {
                                Capsule().fill(LBColor.text.opacity(0.16))
                                Capsule()
                                    .fill(LBColor.gold)
                                    .frame(width: proxy.size.width * progressFraction(progress))
                            }
                        }
                        .frame(width: 690, height: 8)
                        .accessibilityLabel("Playback progress")
                        .accessibilityValue("\(Int((progressFraction(progress) * 100).rounded())) percent")

                        Text("Resume at \(LBPlaybackProgressPolicy.timestamp(progress.seconds))")
                            .font(LBTypography.caption(size: 18, weight: .semibold))
                            .foregroundStyle(LBColor.textSecondary)
                            .accessibilityIdentifier("details-resume-time")
                    }
                    .padding(.top, 20)
                }

                HStack(spacing: 18) {
                    LBPrimaryButton(action: startFullPlayback) {
                        if isPreparingPlayback {
                            HStack(spacing: 14) {
                                ProgressView().tint(LBColor.canvas)
                                Text("Preparing…")
                            }
                        } else {
                            Label(
                                resumableProgress == nil ? "Play" : "Resume",
                                systemImage: "play.fill"
                            )
                        }
                    }
                    .disabled(isPreparingPlayback)
                    .focused($focusedAction, equals: .play)
                    .prefersDefaultFocus(true, in: focusScope)
                    .accessibilityIdentifier("details-play")

                    if resumableProgress != nil {
                        LBSecondaryButton(action: restartPlayback) {
                            Label("Restart", systemImage: "arrow.counterclockwise")
                        }
                        .disabled(isPreparingPlayback)
                        .focused($focusedAction, equals: .restart)
                        .accessibilityIdentifier("details-restart")
                    }
                }
                .padding(.top, 27)
            }
            .padding(.leading, LBSpacing.safeHorizontal)
            .padding(.bottom, 76)
            .frame(maxWidth: 900, maxHeight: .infinity, alignment: .leading)
        }
        .background(LBColor.canvas)
        .ignoresSafeArea()
        .focusSection()
        .defaultFocus($focusedAction, .play)
        .task {
            await Task.yield()
            focusedAction = .play
        }
        .task(id: item.id) {
            previewURL = nil
            previewIsPlaying = false
            previewRequestGeneration += 1
            let generation = previewRequestGeneration
            guard previewsBackdrop, !reduceMotion else { return }
            try? await Task.sleep(nanoseconds: LBPreviewPolicy.delayNanoseconds)
            guard !Task.isCancelled, previewRequestGeneration == generation else { return }
            let preparedURL = await model.preparePreview(for: item)
            guard !Task.isCancelled, previewRequestGeneration == generation else { return }
            previewURL = preparedURL
        }
        .onDisappear { stopPreview() }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.72), value: previewIsPlaying)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("details-screen")
    }

    private var previewsBackdrop: Bool {
#if DEBUG
        !DebugLaunchOptions.fixtureMode
#else
        true
#endif
    }

    @ViewBuilder
    private var backdrop: some View {
        ZStack {
            LBArtwork(item: item, kind: .backdrop)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .opacity(previewIsPlaying ? 0 : 1)

            if let previewURL {
                LBMutedPreview(
                    url: previewURL,
                    targetStartSeconds: LBPreviewPolicy.targetStartSeconds,
                    onPlaying: { previewIsPlaying = true },
                    onStopped: stopPreview
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .opacity(previewIsPlaying ? 1 : 0)
                .id(previewURL)
            }
        }
    }

    private func startFullPlayback() {
        stopPreview()
        onPlay(item, resumableProgress?.seconds ?? 0)
    }

    private func restartPlayback() {
        stopPreview()
        progressStore.clear(profileID: profile.id, movieID: item.id)
        onPlay(item, 0)
    }

    private var resumableProgress: PlaybackProgress? {
        _ = progressStore.revision
        return progressStore.resumableProgress(profileID: profile.id, movieID: item.id)
    }

    private func progressFraction(_ progress: PlaybackProgress) -> CGFloat {
        guard progress.durationSeconds > 0 else { return 0 }
        return CGFloat(min(1, max(0, progress.seconds / progress.durationSeconds)))
    }

    private func stopPreview() {
        previewRequestGeneration += 1
        previewIsPlaying = false
        previewURL = nil
    }
}

private struct DetailBackButton: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.left")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(LBColor.text)
                .frame(width: 56, height: 56)
                .background(LBColor.canvas.opacity(0.52), in: Circle())
                .overlay(Circle().stroke(isFocused ? LBColor.text : LBColor.text.opacity(0.14), lineWidth: isFocused ? 3 : 1))
                .scaleEffect(isFocused ? 1.06 : 1)
                .shadow(color: isFocused ? LBColor.gold.opacity(0.25) : .black.opacity(0.25), radius: 16)
                .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(LBPlainButtonStyle())
        .focusEffectDisabled()
        .accessibilityLabel("Back")
        .accessibilityIdentifier("details-back")
    }
}
