import AVFoundation
import AVKit
import Combine
import SwiftUI
import UIKit

struct PlayerScreen: View {
    private enum ErrorAction: Hashable {
        case retry
        case dismiss
    }

    let session: PlaybackSession
    @ObservedObject var progressStore: PlaybackProgressStore
    let onDismiss: () -> Void

    @StateObject private var controller: PlayerController
    @FocusState private var focusedErrorAction: ErrorAction?

    init(
        session: PlaybackSession,
        progressStore: PlaybackProgressStore,
        onDismiss: @escaping () -> Void
    ) {
        self.session = session
        self.progressStore = progressStore
        self.onDismiss = onDismiss
        _controller = StateObject(
            wrappedValue: PlayerController(session: session, progressStore: progressStore)
        )
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if controller.errorMessage == nil {
                NativePlayerView(controller: controller)
                    .ignoresSafeArea()
            }

            if !controller.isReady, controller.errorMessage == nil {
                VStack(spacing: LBSpacing.medium) {
                    ProgressView().tint(.white).scaleEffect(1.5)
                    Text("Preparing \(session.item.title)…")
                        .font(LBTypography.body(size: 24, weight: .medium))
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
                        .font(LBTypography.display(size: 42, weight: .bold))
                    Text(message)
                        .font(LBTypography.body(size: 24))
                        .foregroundStyle(LBColor.textSecondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 760)
                    HStack(spacing: LBSpacing.medium) {
                        LBPrimaryButton(action: controller.retry) {
                            Label("Retry", systemImage: "arrow.clockwise")
                        }
                        .focused($focusedErrorAction, equals: .retry)
                        .accessibilityIdentifier("player-retry")

                        LBSecondaryButton(action: onDismiss) {
                            Text("Return to details")
                        }
                        .focused($focusedErrorAction, equals: .dismiss)
                        .accessibilityIdentifier("player-return")
                    }
                }
                .foregroundStyle(.white)
                .padding(50)
                .background(LBColor.surface.opacity(0.96), in: RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous))
                .defaultFocus($focusedErrorAction, .retry)
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
    private let session: PlaybackSession
    private let streamURL: URL
    private let progressStore: PlaybackProgressStore?
    private let notificationCenter: NotificationCenter
    private var statusObservation: NSKeyValueObservation?
    private var timeControlObservation: NSKeyValueObservation?
    private var periodicTimeObserver: Any?
    private var failedToEndObservation: NSObjectProtocol?
    private var didPlayToEndObservation: NSObjectProtocol?
    private var shouldAutoplay = false
    private var hasPreparedInitialPosition = false
    private var didStop = false

    init(
        session: PlaybackSession,
        progressStore: PlaybackProgressStore? = nil,
        notificationCenter: NotificationCenter = .default
    ) {
        self.session = session
        title = session.item.title
        streamURL = session.url
        self.progressStore = progressStore
        self.notificationCenter = notificationCenter
        player = AVPlayer()
        player.automaticallyWaitsToMinimizeStalling = true
        installNewItem(autoplay: false)
        observePlayerState()
    }

    func play() {
        shouldAutoplay = true
        if player.currentItem == nil {
            installNewItem(autoplay: true)
        } else if isReady {
            startAtInitialPositionIfNeeded()
        }
    }

    func retry() {
        installNewItem(autoplay: true)
    }

    func stop() {
        guard !didStop else { return }
        didStop = true
        persistProgress()
        removeItemObservers()
        removePlayerObservers()
        player.pause()
        player.replaceCurrentItem(with: nil)
        isReady = false
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

    private func installNewItem(autoplay: Bool) {
        removeItemObservers()
        player.pause()
        didStop = false
        isReady = false
        errorMessage = nil
        shouldAutoplay = autoplay
        hasPreparedInitialPosition = false

        let item = makePlayerItem()
        player.replaceCurrentItem(with: item)
        observe(item)
    }

    private func makePlayerItem() -> AVPlayerItem {
        let item = AVPlayerItem(url: streamURL)

        let titleMetadata = AVMutableMetadataItem()
        titleMetadata.identifier = .commonIdentifierTitle
        titleMetadata.value = title as NSString
        titleMetadata.extendedLanguageTag = "und"
        item.externalMetadata = [titleMetadata]

        return item
    }

    private func observe(_ item: AVPlayerItem) {
        statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            Task { @MainActor in
                guard let self, self.player.currentItem === item else { return }
                switch item.status {
                case .readyToPlay:
                    self.isReady = true
                    self.errorMessage = nil
                    if self.shouldAutoplay {
                        self.startAtInitialPositionIfNeeded()
                    }
                case .failed:
                    self.showPlaybackFailure(
                        "The stream could not be played. Check the connection and try again."
                    )
                case .unknown:
                    self.isReady = false
                @unknown default:
                    self.showPlaybackFailure("The player returned an unexpected state.")
                }
            }
        }

        failedToEndObservation = notificationCenter.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self, weak item] _ in
            Task { @MainActor in
                guard let self, let item, self.player.currentItem === item else { return }
                self.showPlaybackFailure(
                    "The stream stopped unexpectedly. Check the connection and retry."
                )
            }
        }

        didPlayToEndObservation = notificationCenter.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self, weak item] _ in
            Task { @MainActor in
                guard let self, let item, self.player.currentItem === item else { return }
                self.shouldAutoplay = false
                self.persistProgress(completed: true)
            }
        }
    }

    private func showPlaybackFailure(_ message: String) {
        persistProgress()
        player.pause()
        isReady = false
        errorMessage = message
    }

    private func startAtInitialPositionIfNeeded() {
        guard shouldAutoplay, let item = player.currentItem, item.status == .readyToPlay else {
            return
        }
        guard !hasPreparedInitialPosition else {
            player.play()
            return
        }
        hasPreparedInitialPosition = true

        let duration = item.duration.seconds
        let target: Double
        if duration.isFinite, duration > 0 {
            target = min(session.startSeconds, max(0, duration - 1))
        } else {
            target = session.startSeconds
        }
        guard target >= LBPlaybackProgressPolicy.minimumResumeSeconds else {
            player.play()
            return
        }

        player.seek(
            to: CMTime(seconds: target, preferredTimescale: 600),
            toleranceBefore: .zero,
            toleranceAfter: .zero
        ) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.shouldAutoplay else { return }
                self.player.play()
            }
        }
    }

    private func observePlayerState() {
        periodicTimeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 5, preferredTimescale: 600),
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.persistProgress() }
        }

        timeControlObservation = player.observe(
            \.timeControlStatus,
            options: [.old, .new]
        ) { [weak self] _, change in
            guard change.oldValue == .playing, change.newValue == .paused else { return }
            Task { @MainActor in self?.persistProgress() }
        }
    }

    private func persistProgress(completed: Bool? = nil) {
        guard let profileID = session.profileID,
              let progressStore,
              let item = player.currentItem else {
            return
        }
        let seconds = player.currentTime().seconds
        let duration = item.duration.seconds
        guard seconds.isFinite, duration.isFinite, duration > 0 else { return }
        progressStore.save(
            profileID: profileID,
            movieID: session.item.id,
            seconds: seconds,
            durationSeconds: duration,
            completed: completed
        )
    }

    private func removeItemObservers() {
        statusObservation?.invalidate()
        statusObservation = nil
        if let failedToEndObservation {
            notificationCenter.removeObserver(failedToEndObservation)
            self.failedToEndObservation = nil
        }
        if let didPlayToEndObservation {
            notificationCenter.removeObserver(didPlayToEndObservation)
            self.didPlayToEndObservation = nil
        }
    }

    private func removePlayerObservers() {
        timeControlObservation?.invalidate()
        timeControlObservation = nil
        if let periodicTimeObserver {
            player.removeTimeObserver(periodicTimeObserver)
            self.periodicTimeObserver = nil
        }
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
