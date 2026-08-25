import AVFoundation
import LeliBrambasCore
import SwiftUI
import UIKit

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
            LBColor.heroSideScrim
            LBColor.heroScrim

            VStack(alignment: .leading, spacing: LBSpacing.medium) {
                LBSecondaryButton(action: { dismiss() }) {
                    Label("Back", systemImage: "chevron.left")
                }
                .accessibilityIdentifier("details-back")

                Spacer()

                Text(item.title)
                    .font(.system(size: 70, weight: .heavy, design: .rounded))
                    .tracking(-1.4)
                    .foregroundStyle(LBColor.text)
                    .lineLimit(2)
                    .frame(maxWidth: 1000, alignment: .leading)
                    .accessibilityIdentifier("details-title")

                LBMetadataRow(values: [item.year.map(String.init), item.category].compactMap { $0 })

                Text(item.description.isEmpty ? "No description is available for this film." : item.description)
                    .font(.system(size: 27, weight: .regular, design: .rounded))
                    .foregroundStyle(LBColor.textSecondary)
                    .lineSpacing(7)
                    .lineLimit(6)
                    .frame(maxWidth: 920, alignment: .leading)

                HStack(spacing: LBSpacing.medium) {
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
                }
                .padding(.top, 8)
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .background(LBColor.canvas)
        .ignoresSafeArea()
        .task(id: item.id) {
            previewURL = nil
            guard !reduceMotion else { return }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            guard !Task.isCancelled else { return }
            previewURL = await model.preparePreview(for: item)
        }
        .onDisappear { previewURL = nil }
        .accessibilityIdentifier("details-screen")
    }

    @ViewBuilder
    private var backdrop: some View {
        if let previewURL {
            LBMutedPreview(url: previewURL, startSeconds: item.previewStartSeconds)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .id(previewURL)
                .transition(.opacity)
        } else {
            LBArtwork(item: item, kind: .backdrop)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private final class PreviewSurface: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

private struct LBMutedPreview: UIViewRepresentable {
    let url: URL
    let startSeconds: Double

    final class Coordinator {
        var player: AVPlayer?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> PreviewSurface {
        let view = PreviewSurface()
        view.backgroundColor = UIColor.black
        view.playerLayer.videoGravity = .resizeAspectFill
        let player = AVPlayer(url: url)
        player.isMuted = true
        player.actionAtItemEnd = .pause
        view.playerLayer.player = player
        context.coordinator.player = player
        if startSeconds > 0 {
            player.seek(to: CMTime(seconds: startSeconds, preferredTimescale: 600))
        }
        player.play()
        return view
    }

    func updateUIView(_ uiView: PreviewSurface, context: Context) {}

    static func dismantleUIView(_ uiView: PreviewSurface, coordinator: Coordinator) {
        coordinator.player?.pause()
        coordinator.player?.replaceCurrentItem(with: nil)
        uiView.playerLayer.player = nil
    }
}
