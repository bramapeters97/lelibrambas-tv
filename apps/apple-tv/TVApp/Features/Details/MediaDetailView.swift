import AVFoundation
import LeliBrambasCore
import SwiftUI
import UIKit

enum LBPreviewPolicy {
    static let delayNanoseconds: UInt64 = 1_000_000_000
    static let delaySeconds: Double = 1
    static let targetStartSeconds: Double = 120

    static func startSeconds(for durationSeconds: Double?) -> Double {
        guard let durationSeconds, durationSeconds.isFinite else { return targetStartSeconds }
        guard durationSeconds > 1 else { return 0 }
        return min(targetStartSeconds, durationSeconds - 1)
    }
}

struct MediaDetailView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    let item: MediaItem
    @ObservedObject var model: AppModel
    let isPreparingPlayback: Bool
    let onPlay: (MediaItem) -> Void

    @State private var previewURL: URL?

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
                    values: [item.year.map(String.init), item.category, item.category].compactMap { $0 }
                )
                .padding(.top, 17)

                Text(item.description.isEmpty ? "No description is available for this film." : item.description)
                    .font(LBTypography.body(size: 23))
                    .foregroundStyle(LBColor.textSecondary)
                    .lineSpacing(7)
                    .lineLimit(5)
                    .frame(maxWidth: 820, alignment: .leading)
                    .padding(.top, 20)

                LBPrimaryButton(action: { onPlay(item) }) {
                    if isPreparingPlayback {
                        HStack(spacing: 14) {
                            ProgressView().tint(LBColor.canvas)
                            Text("Preparing…")
                        }
                    } else {
                        Label("Play", systemImage: "play.fill")
                    }
                }
                .disabled(isPreparingPlayback)
                .accessibilityIdentifier("details-play")
                .padding(.top, 27)
            }
            .padding(.leading, LBSpacing.safeHorizontal)
            .padding(.bottom, 76)
            .frame(maxWidth: 900, maxHeight: .infinity, alignment: .leading)
        }
        .background(LBColor.canvas)
        .ignoresSafeArea()
        .task(id: item.id) {
            previewURL = nil
            guard previewsBackdrop, !reduceMotion else { return }
            try? await Task.sleep(nanoseconds: LBPreviewPolicy.delayNanoseconds)
            guard !Task.isCancelled else { return }
            let preparedURL = await model.preparePreview(for: item)
            guard !Task.isCancelled else { return }
            previewURL = preparedURL
        }
        .onDisappear { previewURL = nil }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.72), value: previewURL)
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
        if let previewURL {
            LBMutedPreview(url: previewURL)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .id(previewURL)
                .transition(.opacity)
        } else {
            LBArtwork(item: item, kind: .backdrop)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
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
        .buttonStyle(.plain)
        .focusEffectDisabled()
        .accessibilityLabel("Back")
        .accessibilityIdentifier("details-back")
    }
}

private final class PreviewSurface: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

private struct LBMutedPreview: UIViewRepresentable {
    let url: URL

    final class Coordinator {
        var player: AVPlayer?
        var statusObservation: NSKeyValueObservation?
        var hasStarted = false

        func configure(player: AVPlayer, item: AVPlayerItem) {
            self.player = player
            statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
                DispatchQueue.main.async {
                    guard let self, !self.hasStarted, item.status == .readyToPlay else { return }
                    self.hasStarted = true
                    let start = LBPreviewPolicy.startSeconds(for: item.duration.seconds)
                    guard start > 0 else {
                        player.play()
                        return
                    }
                    player.seek(
                        to: CMTime(seconds: start, preferredTimescale: 600),
                        toleranceBefore: .zero,
                        toleranceAfter: .zero
                    ) { _ in
                        player.play()
                    }
                }
            }
        }

        func stop() {
            statusObservation?.invalidate()
            statusObservation = nil
            player?.pause()
            player?.replaceCurrentItem(with: nil)
            player = nil
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> PreviewSurface {
        let view = PreviewSurface()
        view.backgroundColor = UIColor.black
        view.playerLayer.videoGravity = .resizeAspectFill
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.actionAtItemEnd = .pause
        view.playerLayer.player = player
        context.coordinator.configure(player: player, item: item)
        return view
    }

    func updateUIView(_ uiView: PreviewSurface, context: Context) {}

    static func dismantleUIView(_ uiView: PreviewSurface, coordinator: Coordinator) {
        coordinator.stop()
        uiView.playerLayer.player = nil
    }
}
