import AVFoundation
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

enum BundledArtworkResolver {
    static let fallbackPath = "artwork/generic_cinema_2.png"

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

    static func url(for source: String, bundle: Bundle = .main) -> URL? {
        if source.hasPrefix("fixture://") { return nil }
        return resourceURL(for: source, bundle: bundle)
            ?? resourceURL(for: fallbackPath, bundle: bundle)
    }

    private static func resourceURL(for source: String, bundle: Bundle) -> URL? {
        let normalized = source.replacingOccurrences(of: "\\", with: "/")
        guard !normalized.isEmpty,
              !normalized.hasPrefix("/"),
              !normalized.contains("../"),
              URL(string: normalized)?.scheme == nil else {
            return nil
        }

        let relative = normalized.hasPrefix("artwork/")
            ? String(normalized.dropFirst("artwork/".count))
            : normalized
        let component = relative as NSString
        let fileName = component.deletingPathExtension
        let fileExtension = component.pathExtension
        guard !fileName.isEmpty, !fileExtension.isEmpty else { return nil }
        return bundle.url(forResource: fileName, withExtension: fileExtension, subdirectory: "artwork")
    }
}

struct LBArtwork: View {
    private static let imageCache = NSCache<NSString, UIImage>()

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
            if let remoteURL = BundledArtworkResolver.remoteURL(for: source) {
                LBRemoteArtwork(url: remoteURL) {
                    fallbackArtwork
                }
            } else if let image = bundledImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                placeholder
            }
        }
        .aspectRatio(kind == .poster ? LBLayout.cardAspectRatio : LBLayout.backdropAspectRatio, contentMode: .fill)
        .clipped()
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var fallbackArtwork: some View {
        if let image = bundledImage {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else {
            placeholder
        }
    }

    private var bundledImage: UIImage? {
        guard let url = BundledArtworkResolver.url(for: source) else { return nil }
        let cacheKey = url.path as NSString
        if let cached = Self.imageCache.object(forKey: cacheKey) { return cached }
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        Self.imageCache.setObject(image, forKey: cacheKey)
        return image
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

private struct LBRemoteArtwork<Fallback: View>: View {
    let url: URL
    @ViewBuilder let fallback: () -> Fallback

    @State private var image: UIImage?

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
        .task(id: url) {
            image = nil
            let cacheKey = url as NSURL
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
                      let loadedImage = UIImage(data: data) else {
                    return
                }
                LBRemoteArtworkCache.images.setObject(loadedImage, forKey: cacheKey)
                image = loadedImage
            } catch {
                // The bundled generic image remains visible when remote artwork fails.
            }
        }
    }
}

struct LBStudioArtwork: View {
    private static let imageCache = NSCache<NSString, UIImage>()

    var body: some View {
        Group {
            if let image = bundledImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                LBBackground()
            }
        }
        .clipped()
        .accessibilityHidden(true)
    }

    private var bundledImage: UIImage? {
        guard let url = Bundle.main.url(forResource: "lelibrambas-studios", withExtension: "png") else {
            return nil
        }
        let cacheKey = url.path as NSString
        if let cached = Self.imageCache.object(forKey: cacheKey) { return cached }
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        Self.imageCache.setObject(image, forKey: cacheKey)
        return image
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
