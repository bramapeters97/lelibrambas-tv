import Foundation

public enum PlaybackResolutionError: Error, Equatable, Sendable {
    case missingURL
    case insecureTransport
    case unsupportedFormat
}

public enum PlaybackURLResolver {
    public static func resolve(_ rawValue: String?) throws -> URL {
        guard let rawValue,
              let input = URL(string: rawValue.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = input.scheme?.lowercased() else {
            throw PlaybackResolutionError.missingURL
        }
        guard scheme == "https" else { throw PlaybackResolutionError.insecureTransport }

        let path = input.path.lowercased()
        if path.hasSuffix(".m3u8") || path.hasSuffix(".mp4") { return input }

        guard let host = input.host?.lowercased(),
              host == "videodelivery.net" || host.hasSuffix(".videodelivery.net") || host.hasSuffix(".cloudflarestream.com") else {
            throw PlaybackResolutionError.unsupportedFormat
        }
        let segments = input.pathComponents.filter { $0 != "/" }
        guard segments.count == 2,
              ["watch", "iframe"].contains(segments[1].lowercased()) else {
            throw PlaybackResolutionError.unsupportedFormat
        }
        var components = URLComponents(url: input, resolvingAgainstBaseURL: false)
        components?.scheme = "https"
        components?.path = "/\(segments[0])/manifest/video.m3u8"
        components?.query = nil
        components?.fragment = nil
        guard let resolved = components?.url else { throw PlaybackResolutionError.unsupportedFormat }
        return resolved
    }
}
