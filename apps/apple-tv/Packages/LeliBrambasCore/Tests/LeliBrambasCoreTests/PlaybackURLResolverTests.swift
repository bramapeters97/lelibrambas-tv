import Foundation
import XCTest
@testable import LeliBrambasCore

final class PlaybackURLResolverTests: XCTestCase {
    func testAcceptsSecureHLSAndMP4URLs() throws {
        let hls = try PlaybackURLResolver.resolve(" https://media.example.test/fixture/movie.m3u8?token=synthetic ")
        XCTAssertEqual(hls.absoluteString, "https://media.example.test/fixture/movie.m3u8?token=synthetic")

        let mp4 = try PlaybackURLResolver.resolve("https://media.example.test/fixture/movie.mp4")
        XCTAssertEqual(mp4.pathExtension, "mp4")
    }

    func testConvertsSyntheticCloudflareWatchURLToManifest() throws {
        let host = ["fixture", "cloudflarestream", "com"].joined(separator: ".")
        let resolved = try PlaybackURLResolver.resolve(
            "https://\(host)/synthetic-asset-0001/watch?autoplay=true#ignored"
        )
        XCTAssertEqual(
            resolved.absoluteString,
            "https://\(host)/synthetic-asset-0001/manifest/video.m3u8"
        )
    }

    func testRejectsMissingInsecureAndUnsupportedURLs() {
        XCTAssertThrowsError(try PlaybackURLResolver.resolve(nil)) { error in
            XCTAssertEqual(error as? PlaybackResolutionError, .missingURL)
        }
        XCTAssertThrowsError(
            try PlaybackURLResolver.resolve("http://media.example.test/fixture/movie.m3u8")
        ) { error in
            XCTAssertEqual(error as? PlaybackResolutionError, .insecureTransport)
        }
        XCTAssertThrowsError(
            try PlaybackURLResolver.resolve("https://media.example.test/fixture/movie.mov")
        ) { error in
            XCTAssertEqual(error as? PlaybackResolutionError, .unsupportedFormat)
        }
    }
}
