import AVFoundation
import ImageIO
import LeliBrambasCore
import SwiftUI
import UIKit

enum LBArtworkKind {
    case poster
    case backdrop
}

enum LBMediaPreviewTiming {
    static func startSeconds(target: Double, durationSeconds: Double?) -> Double {
        guard let durationSeconds, durationSeconds.isFinite else { return target }
        guard durationSeconds > 1 else { return 0 }
        return min(target, durationSeconds - 1)
    }
}

enum RemoteArtworkResolver {
    static func remoteURL(for source: String) -> URL? {
        guard let components = URLComponents(string: source),
              components.scheme?.lowercased() == "https",
              components.host?.isEmpty == false,
              components.user == nil,
              components.password == nil else {
            return nil
        }
        return components.url
    }
}

struct LBArtwork: View {
    let item: MediaItem
    let kind: LBArtworkKind

    private var source: String {
        switch kind {
        case .poster:
            return item.posterURL
        case .backdrop:
            return item.backdropURL ?? item.posterURL
        }
    }

    var body: some View {
        Group {
            if let remoteURL = RemoteArtworkResolver.remoteURL(for: source) {
                LBRemoteArtwork(url: remoteURL) {
                    placeholder
                }
            } else {
                placeholder
            }
        }
        .aspectRatio(kind == .poster ? LBLayout.cardAspectRatio : LBLayout.backdropAspectRatio, contentMode: .fill)
        .clipped()
        .accessibilityHidden(true)
    }

    private var placeholder: some View {
        let palette = LBArtwork.palette(for: item.id)
        return ZStack {
            LinearGradient(colors: palette, startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(
                colors: [LBColor.cyan.opacity(0.3), .clear],
                center: .topTrailing,
                startRadius: 10,
                endRadius: kind == .poster ? 280 : 800
            )
            VStack(spacing: 12) {
                Image(systemName: "play.rectangle.fill")
                    .font(.system(size: kind == .poster ? 42 : 74, weight: .semibold))
                Text(item.title)
                    .font(LBTypography.title(size: kind == .poster ? 20 : 34, weight: .bold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal)
            }
            .foregroundStyle(LBColor.text.opacity(0.88))
        }
    }

    private static func palette(for id: Int) -> [Color] {
        switch abs(id) % 5 {
        case 0: return [Color(red: 0.16, green: 0.11, blue: 0.31), Color(red: 0.43, green: 0.19, blue: 0.27)]
        case 1: return [Color(red: 0.05, green: 0.20, blue: 0.31), Color(red: 0.17, green: 0.35, blue: 0.40)]
        case 2: return [Color(red: 0.24, green: 0.12, blue: 0.18), Color(red: 0.52, green: 0.30, blue: 0.18)]
        case 3: return [Color(red: 0.08, green: 0.16, blue: 0.27), Color(red: 0.26, green: 0.23, blue: 0.52)]
        default: return [Color(red: 0.10, green: 0.23, blue: 0.19), Color(red: 0.33, green: 0.29, blue: 0.17)]
        }
    }
}

private enum LBRemoteArtworkCache {
    static let images = NSCache<NSURL, UIImage>()
}

struct LBRemoteArtwork<Fallback: View>: View {
    let url: URL
    var maximumPixelSize: Int? = nil
    var showsLoadingIndicator = false
    @ViewBuilder let fallback: () -> Fallback

    @State private var image: UIImage?
    @State private var isLoading = true

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                fallback()
            }
        }
        .overlay {
            if showsLoadingIndicator && isLoading {
                ProgressView().tint(.white).accessibilityHidden(true)
            }
        }
        .task(id: url) {
            image = nil
            isLoading = true
            defer { isLoading = false }
            let cacheKey = maximumPixelSize.map {
                NSURL(string: url.absoluteString + "#pixels=\($0)") ?? (url as NSURL)
            } ?? (url as NSURL)
            if let cached = LBRemoteArtworkCache.images.object(forKey: cacheKey) {
                image = cached
                return
            }

            do {
                var request = URLRequest(
                    url: url,
                    cachePolicy: .useProtocolCachePolicy,
                    timeoutInterval: 20
                )
                request.httpMethod = "GET"
                let (data, response) = try await URLSession.shared.data(for: request)
                guard !Task.isCancelled,
                      let response = response as? HTTPURLResponse,
                      (200..<300).contains(response.statusCode),
                      let loadedImage = decodeImage(data) else {
                    return
                }
                LBRemoteArtworkCache.images.totalCostLimit = 64 * 1_024 * 1_024
                LBRemoteArtworkCache.images.setObject(
                    loadedImage, forKey: cacheKey,
                    cost: Int(loadedImage.size.width * loadedImage.size.height * loadedImage.scale * loadedImage.scale * 4)
                )
                image = loadedImage
            } catch {
                // The code-rendered placeholder remains visible when remote artwork fails.
            }
        }
    }
    private func decodeImage(_ data: Data) -> UIImage? {
        guard let maximumPixelSize else { return UIImage(data: data) }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: maximumPixelSize
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }

}

struct LBStudioArtwork: View {
    private static let artworkURL = URL(
        string: "https://assets.lelibrambas.com/lelibrambas_studios.png"
    )!

    var body: some View {
        AsyncImage(url: Self.artworkURL) { phase in
            if let image = phase.image {
                image
                    .resizable()
                    .scaledToFill()
            } else {
                LBBackground()
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }
}

final class LBPreviewSurface: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

struct LBMutedPreview: UIViewRepresentable {
    let url: URL
    let targetStartSeconds: Double
    var onPlaying: (() -> Void)?
    var onStopped: (() -> Void)?

    final class Coordinator {
        var player: AVPlayer?
        var item: AVPlayerItem?
        var itemStatusObservation: NSKeyValueObservation?
        var playbackObservation: NSKeyValueObservation?
        var endObserver: NSObjectProtocol?
        var failureObserver: NSObjectProtocol?
        var hasPrepared = false
        var hasReportedPlayback = false
        var isActive = false

        func configure(
            player: AVPlayer,
            item: AVPlayerItem,
            targetStartSeconds: Double,
            onPlaying: (() -> Void)?,
            onStopped: (() -> Void)?
        ) {
            self.player = player
            self.item = item
            hasPrepared = false
            hasReportedPlayback = false
            isActive = true
            itemStatusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
                DispatchQueue.main.async {
                    guard let self, self.isCurrent(player: player, item: item) else { return }
                    if item.status == .failed {
                        self.isActive = false
                        onStopped?()
                        return
                    }
                    guard !self.hasPrepared, item.status == .readyToPlay else { return }
                    self.hasPrepared = true
                    let startSeconds = LBMediaPreviewTiming.startSeconds(
                        target: targetStartSeconds,
                        durationSeconds: item.duration.seconds
                    )
                    guard startSeconds > 0 else {
                        player.play()
                        return
                    }
                    player.seek(
                        to: CMTime(seconds: startSeconds, preferredTimescale: 600),
                        toleranceBefore: .zero,
                        toleranceAfter: .zero
                    ) { [weak self, weak player, weak item] finished in
                        DispatchQueue.main.async {
                            guard finished,
                                  let self,
                                  let player,
                                  let item,
                                  self.isCurrent(player: player, item: item) else { return }
                            player.play()
                        }
                    }
                }
            }
            playbackObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] player, _ in
                DispatchQueue.main.async {
                    guard let self,
                          self.isCurrent(player: player, item: item),
                          !self.hasReportedPlayback,
                          player.timeControlStatus == .playing else { return }
                    self.hasReportedPlayback = true
                    onPlaying?()
                }
            }
            endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                guard let self, self.isCurrent(player: player, item: item) else { return }
                self.isActive = false
                onStopped?()
            }
            failureObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemFailedToPlayToEndTime,
                object: item,
                queue: .main
            ) { [weak self] _ in
                guard let self, self.isCurrent(player: player, item: item) else { return }
                self.isActive = false
                onStopped?()
            }
        }

        func stop() {
            isActive = false
            item?.cancelPendingSeeks()
            player?.cancelPendingPrerolls()
            itemStatusObservation?.invalidate()
            itemStatusObservation = nil
            playbackObservation?.invalidate()
            playbackObservation = nil
            if let endObserver {
                NotificationCenter.default.removeObserver(endObserver)
                self.endObserver = nil
            }
            if let failureObserver {
                NotificationCenter.default.removeObserver(failureObserver)
                self.failureObserver = nil
            }
            player?.pause()
            player?.replaceCurrentItem(with: nil)
            player = nil
            item = nil
            hasPrepared = false
            hasReportedPlayback = false
        }

        private func isCurrent(player: AVPlayer, item: AVPlayerItem) -> Bool {
            isActive && self.player === player && self.item === item
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> LBPreviewSurface {
        let view = LBPreviewSurface()
        view.backgroundColor = UIColor.black
        view.playerLayer.videoGravity = .resizeAspectFill
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        player.isMuted = true
        player.actionAtItemEnd = .pause
        view.playerLayer.player = player
        context.coordinator.configure(
            player: player,
            item: item,
            targetStartSeconds: targetStartSeconds,
            onPlaying: onPlaying,
            onStopped: onStopped
        )
        return view
    }

    func updateUIView(_ uiView: LBPreviewSurface, context: Context) {}

    static func dismantleUIView(_ uiView: LBPreviewSurface, coordinator: Coordinator) {
        coordinator.stop()
        uiView.playerLayer.player = nil
    }
}
