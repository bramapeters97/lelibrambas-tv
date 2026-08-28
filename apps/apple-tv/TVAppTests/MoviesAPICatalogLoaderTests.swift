import Foundation
import LeliBrambasCore
import XCTest
@testable import LeliBrambasTV

final class MoviesAPICatalogLoaderTests: XCTestCase {
    private let endpoint = URL(string: "https://catalogue.example.test/api/movies")!

    func testValidAPIResponseIsPreferredAndMappedWithoutReordering() async throws {
        let transport = StubMoviesAPITransport(results: [.success(response(data: validPayload))])
        let fallback = CountingCatalogLoader(items: [fallbackItem])
        let loader = FallbackCatalogLoader(
            primary: MoviesAPICatalogLoader(endpoint: endpoint, transport: transport),
            fallback: fallback
        )

        let items = try await loader.loadCatalog()

        XCTAssertEqual(items.map(\.id), [12, 7])
        XCTAssertEqual(items.map(\.posterURL), [
            "https://assets.example.test/synthetic-twelve.png",
            "https://assets.example.test/synthetic-seven.png",
        ])
        XCTAssertEqual(items.map(\.streamURL), [
            "https://customer-example.cloudflarestream.com/synthetic-twelve/watch",
            "https://media.example.test/synthetic-seven.m3u8",
        ])
        XCTAssertEqual(items.map(\.createdAt), ["2026-08-28 12:00:00", "2026-08-28 12:01:00"])
        let fallbackRequestCount = await fallback.requestCount
        let requests = await transport.requests
        XCTAssertEqual(fallbackRequestCount, 0)

        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.url, endpoint)
        XCTAssertEqual(request.httpMethod, "GET")
        XCTAssertEqual(request.cachePolicy, .reloadIgnoringLocalCacheData)
        XCTAssertEqual(request.timeoutInterval, MoviesAPIConfiguration.requestTimeout)
    }

    func testIntegerAndNumericStringIDsDecodeToStableIntegers() async throws {
        let loader = makeAPILoader(data: validPayload)

        let items = try await loader.loadCatalog()

        XCTAssertEqual(items.map(\.id), [12, 7])
    }

    func testCategoryGroupingPreservesSourceOrderWithinEveryShelf() async throws {
        let items = try await makeAPILoader(data: validPayload).loadCatalog()

        let sections = CatalogOrganizer.sectionsPreservingItemOrder(from: items)

        XCTAssertEqual(sections.map(\.title), ["JEUGDFILMS", "EVENTS"])
        XCTAssertEqual(sections.flatMap(\.items).map(\.id), [12, 7])
        XCTAssertEqual(LBHomeContent.allMovies(from: items)?.items.map(\.id), [12, 7])
        XCTAssertEqual(LBSearchIndex.results(in: items, query: "").map(\.id), [12, 7])
    }

    func testInvalidRequiredRecordsUseTheCompleteBundledFallback() async throws {
        let invalidPayloads = [
            Data("not-json".utf8),
            Data("{\"id\":1}".utf8),
            Data("[]".utf8),
            Data("[\(record(id: \"1\")),\(record(id: \"1\"))]".utf8),
            Data("[\(record(id: \"\\\"not-numeric\\\"\"))]".utf8),
            Data("[{\"id\":1,\"year\":null,\"description\":\"Synthetic\",\"category\":\"OTHERS\",\"poster_url\":\"https://assets.example.test/missing-title.png\",\"stream_video_id\":\"https://media.example.test/missing-title.m3u8\",\"created_at\":\"2026-08-28 12:00:00\"}]".utf8),
            Data("[{\"id\":1,\"title\":\"Synthetic\",\"description\":\"Synthetic\",\"category\":\"OTHERS\",\"poster_url\":\"https://assets.example.test/missing-year.png\",\"stream_video_id\":\"https://media.example.test/missing-year.m3u8\",\"created_at\":\"2026-08-28 12:00:00\"}]".utf8),
        ]

        for payload in invalidPayloads {
            let fallback = CountingCatalogLoader(items: [fallbackItem])
            let loader = FallbackCatalogLoader(
                primary: makeAPILoader(data: payload),
                fallback: fallback
            )

            let items = try await loader.loadCatalog()

            XCTAssertEqual(items.map(\.id), [fallbackItem.id])
            let fallbackRequestCount = await fallback.requestCount
            XCTAssertEqual(fallbackRequestCount, 1)
        }
    }

    func testHTTPAndNetworkFailuresUseFallback() async throws {
        let failures: [Result<(Data, URLResponse), Error>] = [
            .success(response(data: validPayload, statusCode: 503)),
            .failure(URLError(.timedOut)),
            .failure(URLError(.notConnectedToInternet)),
        ]

        for failure in failures {
            let transport = StubMoviesAPITransport(results: [failure])
            let fallback = CountingCatalogLoader(items: [fallbackItem])
            let loader = FallbackCatalogLoader(
                primary: MoviesAPICatalogLoader(endpoint: endpoint, transport: transport),
                fallback: fallback
            )

            let items = try await loader.loadCatalog()

            XCTAssertEqual(items.map(\.id), [fallbackItem.id])
            let fallbackRequestCount = await fallback.requestCount
            XCTAssertEqual(fallbackRequestCount, 1)
        }
    }

    func testEveryLoadPerformsAFreshAPIRequest() async throws {
        let first = Data("[\(record(id: \"1\", title: \"First response\"))]".utf8)
        let second = Data("[\(record(id: \"2\", title: \"Second response\"))]".utf8)
        let transport = StubMoviesAPITransport(results: [
            .success(response(data: first)),
            .success(response(data: second)),
        ])
        let loader = MoviesAPICatalogLoader(endpoint: endpoint, transport: transport)

        let firstItems = try await loader.loadCatalog()
        let secondItems = try await loader.loadCatalog()

        XCTAssertEqual(firstItems.map(\.id), [1])
        XCTAssertEqual(secondItems.map(\.id), [2])
        let requests = await transport.requests
        XCTAssertEqual(requests.count, 2)
    }

    func testRemotePosterURLIsUsedDirectlyAndLocalPathsRemainBundled() throws {
        let remoteSource = "https://assets.example.test/synthetic-poster.png"
        let remote = try XCTUnwrap(BundledArtworkResolver.remoteURL(for: remoteSource))

        XCTAssertEqual(remote.absoluteString, remoteSource)
        XCTAssertNil(BundledArtworkResolver.remoteURL(for: "artwork/generic_cinema_2.png"))
        XCTAssertNil(BundledArtworkResolver.remoteURL(for: "http://assets.example.test/insecure.png"))

        let bundled = try XCTUnwrap(
            BundledArtworkResolver.url(for: "artwork/generic_cinema_2.png")
        )
        let missing = try XCTUnwrap(
            BundledArtworkResolver.url(for: "artwork/missing-synthetic-poster.png")
        )
        XCTAssertEqual(bundled.lastPathComponent, "generic_cinema_2.png")
        XCTAssertEqual(missing, bundled)
    }

    func testBundledCatalogueStillLoadsAsOfflineFallback() async throws {
        let items = try await BundledCatalogLoader().loadCatalog()

        XCTAssertFalse(items.isEmpty)
        XCTAssertEqual(Set(items.map(\.id)).count, items.count)
        XCTAssertGreaterThan(Set(items.compactMap(\.streamURL)).count, 1)
    }

    private var validPayload: Data {
        Data(
            "[\(record(id: \"\\\"12\\\"\", title: \"Synthetic Twelve\", category: \"JEUGDFILMS\", poster: \"https://assets.example.test/synthetic-twelve.png\", stream: \"https://customer-example.cloudflarestream.com/synthetic-twelve/watch\", createdAt: \"2026-08-28 12:00:00\")),\(record(id: \"7\", title: \"Synthetic Seven\", category: \"EVENTS\", poster: \"https://assets.example.test/synthetic-seven.png\", stream: \"https://media.example.test/synthetic-seven.m3u8\", createdAt: \"2026-08-28 12:01:00\"))]".utf8
        )
    }

    private var fallbackItem: MediaItem {
        MediaItem(
            id: 999,
            title: "Synthetic Offline Fallback",
            year: 2024,
            description: "Synthetic fallback fixture.",
            category: "OTHERS",
            posterURL: "artwork/generic_cinema_2.png",
            streamURL: "https://media.example.test/synthetic-fallback.m3u8"
        )
    }

    private func makeAPILoader(data: Data) -> MoviesAPICatalogLoader {
        MoviesAPICatalogLoader(
            endpoint: endpoint,
            transport: StubMoviesAPITransport(results: [.success(response(data: data))])
        )
    }

    private func response(data: Data, statusCode: Int = 200) -> (Data, URLResponse) {
        (
            data,
            HTTPURLResponse(
                url: endpoint,
                statusCode: statusCode,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
        )
    }

    private func record(
        id: String,
        title: String = "Synthetic Movie",
        category: String = "OTHERS",
        poster: String = "https://assets.example.test/synthetic.png",
        stream: String = "https://media.example.test/synthetic.m3u8",
        createdAt: String = "2026-08-28 12:00:00"
    ) -> String {
        """
        {"id":\(id),"title":"\(title)","year":2026,"description":"Synthetic test record.","category":"\(category)","poster_url":"\(poster)","stream_video_id":"\(stream)","created_at":"\(createdAt)"}
        """
    }
}

private actor StubMoviesAPITransport: MoviesAPITransport {
    private var results: [Result<(Data, URLResponse), Error>]
    private(set) var requests: [URLRequest] = []

    init(results: [Result<(Data, URLResponse), Error>]) {
        self.results = results
    }

    func data(for request: URLRequest) async throws -> (Data, URLResponse) {
        requests.append(request)
        guard !results.isEmpty else { throw URLError(.resourceUnavailable) }
        return try results.removeFirst().get()
    }
}

private actor CountingCatalogLoader: CatalogLoading {
    private let items: [MediaItem]
    private(set) var requestCount = 0

    init(items: [MediaItem]) {
        self.items = items
    }

    func loadCatalog() async throws -> [MediaItem] {
        requestCount += 1
        return items
    }
}
