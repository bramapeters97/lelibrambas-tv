import AVFoundation
import AVKit
import Combine
import SwiftUI
import UIKit

struct PlayerScreen: View {
    let session: PlaybackSession
    let onDismiss: () -> Void

    @StateObject private var controller: PlayerController

    init(session: PlaybackSession, onDismiss: @escaping () -> Void) {
        self.session = session
        self.onDismiss = onDismiss
        _controller = StateObject(wrappedValue: PlayerController(session: session))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            NativePlayerView(controller: controller)
                .ignoresSafeArea()

            if !controller.isReady, controller.errorMessage == nil {
                VStack(spacing: LBSpacing.medium) {
                    ProgressView().tint(.white).scaleEffect(1.5)
                    Text("Preparing \(session.item.title)…")
                        .font(.system(size: 24, weight: .medium, design: .rounded))
                        .foregroundStyle(.white)
                }
                .accessibilityIdentifier("player-loading")
            }

            if let message = controller.errorMessage {
                VStack(spacing: LBSpacing.medium) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(LBColor.gold)
                    Text("Playback stopped")
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                    Text(message)
                        .font(.system(size: 24, design: .rounded))
                        .foregroundStyle(LBColor.textSecondary)
                    LBPrimaryButton(action: onDismiss) { Text("Return to details") }
                }
                .foregroundStyle(.white)
                .padding(50)
                .background(LBColor.surface.opacity(0.96), in: RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous))
                .accessibilityIdentifier("player-error")
            }
        }
        .onAppear { controller.play() }
        .onDisappear { controller.stop() }
        .onExitCommand(perform: onDismiss)
        .accessibilityIdentifier("player-screen")
    }
}

@MainActor
final class PlayerController: ObservableObject {
    @Published private(set) var isReady = false
    @Published private(set) var errorMessage: String?

    let player: AVPlayer
    let title: String
    private var statusObservation: NSKeyValueObservation?

    init(session: PlaybackSession) {
        title = session.item.title
        let item = AVPlayerItem(url: session.url)
        player = AVPlayer(playerItem: item)
        player.automaticallyWaitsToMinimizeStalling = true

        let titleMetadata = AVMutableMetadataItem()
        titleMetadata.identifier = .commonIdentifierTitle
        titleMetadata.value = session.item.title as NSString
        titleMetadata.extendedLanguageTag = "und"
        item.externalMetadata = [titleMetadata]

        statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self else { return }
                switch item.status {
                case .readyToPlay:
                    self.isReady = true
                    self.errorMessage = nil
                case .failed:
                    self.isReady = false
                    self.errorMessage = "The stream could not be played. Check the connection and try again."
                case .unknown:
                    self.isReady = false
                @unknown default:
                    self.isReady = false
                    self.errorMessage = "The player returned an unexpected state."
                }
            }
        }
    }

    func play() { player.play() }

    func stop() {
        player.pause()
        player.replaceCurrentItem(with: nil)
    }

    func seek(by offset: Double) {
        let current = player.currentTime().seconds
        guard current.isFinite else { return }
        var destination = max(0, current + offset)
        let duration = player.currentItem?.duration.seconds ?? .nan
        if duration.isFinite { destination = min(destination, duration) }
        player.seek(
            to: CMTime(seconds: destination, preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        )
    }
}

private struct NativePlayerView: UIViewControllerRepresentable {
    @ObservedObject var controller: PlayerController

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let viewController = AVPlayerViewController()
        viewController.player = controller.player
        viewController.showsPlaybackControls = true
        viewController.playbackControlsIncludeTransportBar = true
        viewController.transportBarIncludesTitleView = true

        let backward = UIAction(
            title: String(localized: "10 seconds back"),
            image: UIImage(systemName: "gobackward.10")
        ) { _ in
            controller.seek(by: -10)
        }
        let forward = UIAction(
            title: String(localized: "10 seconds forward"),
            image: UIImage(systemName: "goforward.10")
        ) { _ in
            controller.seek(by: 10)
        }
        viewController.transportBarCustomMenuItems = [backward, forward]
        return viewController
    }

    func updateUIViewController(_ uiViewController: AVPlayerViewController, context: Context) {
        if uiViewController.player !== controller.player {
            uiViewController.player = controller.player
        }
    }

    static func dismantleUIViewController(_ uiViewController: AVPlayerViewController, coordinator: Void) {
        uiViewController.player?.pause()
        uiViewController.player = nil
    }
}
