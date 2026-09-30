import AVFoundation
import AVKit
import SwiftUI

struct MobilePlayerScreen: View {
    @EnvironmentObject private var progress: PlaybackProgressStore
    @Environment(\.dismiss) private var dismiss
    let session: PlaybackSession

    var body: some View {
        MobilePlayerContent(session: session, progress: progress, onDismiss: { dismiss() })
    }
}

private struct MobilePlayerContent: View {
    @StateObject private var controller: PlayerController
    let onDismiss: () -> Void

    init(session: PlaybackSession, progress: PlaybackProgressStore, onDismiss: @escaping () -> Void) {
        _controller = StateObject(wrappedValue: PlayerController(session: session, progressStore: progress))
        self.onDismiss = onDismiss
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let error = controller.errorMessage {
                VStack(spacing: 20) {
                    Text("Playback stopped").font(.title2.bold())
                    Text(error).foregroundStyle(.secondary)
                    Button("Try again", action: controller.retry).buttonStyle(.borderedProminent)
                    Button("Return to details", action: onDismiss).frame(minHeight: 44)
                }
                .multilineTextAlignment(.center).padding(24)
            } else {
                MobileNativePlayer(controller: controller).ignoresSafeArea()
                if !controller.isReady {
                    ProgressView("Preparing \(controller.title)…")
                        .tint(.white).padding().allowsHitTesting(false)
                }
            }
        }
        .safeAreaInset(edge: .top, alignment: .leading, spacing: 0) {
            Button {
                controller.stop()
                onDismiss()
            } label: {
                Label("Close", systemImage: "xmark")
                    .font(.body.weight(.semibold))
                    .padding(.horizontal, 16).frame(minHeight: 44)
                    .background(.black.opacity(0.8), in: Capsule())
            }
            .foregroundStyle(.white).padding(.horizontal, 12)
            .accessibilityLabel("Close film")
            .accessibilityIdentifier("player-close")
        }
        .onAppear {
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                // AVPlayer still reports actionable stream errors through the shared controller.
            }
            controller.play()
        }
        .onDisappear {
            controller.stop()
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)) { notification in
            guard let ended = notification.object as? AVPlayerItem,
                  ended === controller.player.currentItem else { return }
            // PlayerController receives the same event first and persists completion.
            onDismiss()
        }
        .accessibilityIdentifier("player-screen")
    }
}

private struct MobileNativePlayer: UIViewControllerRepresentable {
    @ObservedObject var controller: PlayerController

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let viewController = AVPlayerViewController()
        viewController.player = controller.player
        viewController.showsPlaybackControls = true
        viewController.allowsPictureInPicturePlayback = true
        viewController.canStartPictureInPictureAutomaticallyFromInline = true
        viewController.updatesNowPlayingInfoCenter = true
        viewController.delegate = context.coordinator
        controller.player.allowsExternalPlayback = true
        return viewController
    }

    func updateUIViewController(_ viewController: AVPlayerViewController, context: Context) {
        if viewController.player !== controller.player { viewController.player = controller.player }
    }

    static func dismantleUIViewController(_ viewController: AVPlayerViewController, coordinator: Coordinator) {
        viewController.player = nil
    }

    final class Coordinator: NSObject, AVPlayerViewControllerDelegate {
        func playerViewController(
            _ playerViewController: AVPlayerViewController,
            restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void
        ) {
            // The full-screen cover is retained during PiP, including when the app backgrounds.
            completionHandler(true)
        }
    }
}
