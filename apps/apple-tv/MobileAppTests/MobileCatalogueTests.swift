import Foundation
import XCTest
import LeliBrambasCore
#if LB_CINEMA
@testable import LeliBrambasCinema
#elseif LB_COMPACT
@testable import LeliBrambasCompact
#else
@testable import LeliBrambasClassic
#endif

@MainActor
final class MobileCatalogueTests: XCTestCase {
    func testPriorityOrderingIsStableAndDoesNotSortEqualPriorityByID() {
        let items = [movie(9, priority: 0), movie(4, priority: 2),
                     movie(2, priority: 0), movie(7, priority: -1)]
        XCTAssertEqual(MobileCatalogue.ordered(items).map(\.id), [4, 9, 2, 7])
    }

    func testUnavailableAndComingSoonCannotStartMoviesOrPreviews() {
        XCTAssertTrue(MobileCatalogue.canPlay(movie(1)))
        XCTAssertFalse(MobileCatalogue.canPlay(movie(2, available: false)))
        XCTAssertFalse(MobileCatalogue.canPlay(movie(3, priority: -1)))
        XCTAssertFalse(MobileCatalogue.canPlay(movie(4, source: "http://media.example.test/a.m3u8")))
        XCTAssertEqual(MobileCatalogue.availability(movie(3, priority: -1)), "Coming soon")
    }

    func testRelatedFilmsExcludeCurrentFilmAndOtherCategories() {
        let current = movie(1)
        let otherCategory = MediaItem(id: 20, title: "Synthetic event", year: nil,
                                      description: "", category: "EVENTS", posterURL: "")
        let items = [current, movie(2), movie(3), movie(4), movie(5), movie(6), otherCategory]
        let seed = UUID()
        let first = MobileCatalogue.related(to: current, in: items, seed: seed)
        XCTAssertEqual(first.count, 4)
        XCTAssertFalse(first.contains { $0.id == 1 || $0.id == 20 })
        XCTAssertEqual(first, MobileCatalogue.related(to: current, in: items, seed: seed))
    }

    func testEditorialMetadataIsOptInAndLegacyTVMappingStaysUnchanged() async throws {
        let payload = Data("""
        [{"id":12,"title":"Synthetic release","year":2026,"description":"Synthetic",
          "category":"OTHERS","poster_url":"https://assets.example.test/poster.png",
          "stream_video_id":"https://media.example.test/a.m3u8","created_at":"",
          "featured":1,"available":0,"priority":-1,"duration_seconds":600,
          "preview_start_seconds":15,"backdrop_url":"https://assets.example.test/wide.png"}]
        """.utf8)
        let transport = SyntheticTransport(data: payload)
        let endpoint = try XCTUnwrap(URL(string: "https://catalogue.example.test/api/movies"))
        let mobile = try await MoviesAPICatalogLoader(endpoint: endpoint, transport: transport,
                                                     includesEditorialMetadata: true).loadCatalog()
        let tv = try await MoviesAPICatalogLoader(endpoint: endpoint, transport: transport).loadCatalog()
        XCTAssertTrue(mobile[0].featured)
        XCTAssertFalse(mobile[0].available)
        XCTAssertEqual(mobile[0].priority, -1)
        XCTAssertEqual(mobile[0].previewStartSeconds, 15)
        XCTAssertEqual(mobile[0].durationSeconds, 600)
        XCTAssertNotNil(mobile[0].backdropURL)
        XCTAssertFalse(tv[0].featured)
        XCTAssertTrue(tv[0].available)
        XCTAssertEqual(tv[0].priority, 0)
        XCTAssertNil(tv[0].backdropURL)
        XCTAssertNil(tv[0].durationSeconds)
    }

    func testVariantIsProvidedByTheApplicationBundle() {
#if LB_CINEMA
        XCTAssertEqual(MobileVariant.current, .cinema)
#elseif LB_COMPACT
        XCTAssertEqual(MobileVariant.current, .compact)
#else
        XCTAssertEqual(MobileVariant.current, .classic)
#endif
    }

    private func movie(_ id: Int, available: Bool = true, priority: Int = 0,
                       source: String = "https://media.example.test/synthetic.m3u8") -> MediaItem {
        MediaItem(id: id, title: "Synthetic \(id)", year: 2026, description: "Synthetic",
                  category: "OTHERS", posterURL: "", streamURL: source,
                  available: available, priority: priority)
    }
}

private struct SyntheticTransport: MoviesAPITransport {
    let data: Data

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        let url = try XCTUnwrap(request.url)
        let response = try XCTUnwrap(HTTPURLResponse(url: url, statusCode: 200,
                                                   httpVersion: nil, headerFields: nil))
        return (data, response)
    }
}
