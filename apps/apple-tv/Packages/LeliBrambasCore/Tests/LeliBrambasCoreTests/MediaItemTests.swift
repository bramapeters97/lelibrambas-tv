import Foundation
import XCTest
@testable import LeliBrambasCore

final class MediaItemTests: XCTestCase {
    func testCatalogFixtureDecodesStringAndIntegerIDsWithSafeDefaults() throws {
        let decoder = JSONDecoder()
        let items = try decoder.decode(
            APIEnvelope<[MediaItem]>.self,
            from: TestFixtures.data(named: "catalog")
        ).data

        XCTAssertEqual(items.map(\.id), [101, 102, 103, 104])
        XCTAssertEqual(items[0].title, "The Lantern Archive")
        XCTAssertEqual(items[0].previewStartSeconds, 12)
        XCTAssertEqual(items[1].description, "")
        XCTAssertEqual(items[1].sortOrder, 102)
        XCTAssertEqual(items[2].previewStartSeconds, 0)
    }

    func testInvalidIDFailsDecoding() throws {
        let data = Data(
            """
            {"id":"not-an-integer","title":"Synthetic","category":"OTHERS"}
            """.utf8
        )
        XCTAssertThrowsError(try JSONDecoder().decode(MediaItem.self, from: data))
    }

    func testOrganizerSortsItemsAndUsesStablePreferredSectionOrder() throws {
        let items = try JSONDecoder().decode(
            APIEnvelope<[MediaItem]>.self,
            from: TestFixtures.data(named: "catalog")
        ).data
        let sorted = CatalogOrganizer.sorted(items)
        XCTAssertEqual(sorted.map(\.id), [104, 103, 101, 102])

        let sections = CatalogOrganizer.sections(from: items)
        XCTAssertEqual(sections.map(\.title), ["JEUGDFILMS", "VAKANTIEFILMS", "EVENTS", "SCI-FI & FANTASY"])
        XCTAssertEqual(sections.map(\.id), ["jeugdfilms", "vakantiefilms", "events", "sci-fi-fantasy"])
    }

    func testFeaturedItemUsesSortedFeaturedThenFirstFallback() {
        let first = makeItem(id: 1, sortOrder: 20, featured: false)
        let featured = makeItem(id: 2, sortOrder: 30, featured: true)
        let earlier = makeItem(id: 3, sortOrder: 10, featured: false)
        XCTAssertEqual(CatalogOrganizer.featuredItem(in: [first, featured, earlier]), featured)
        XCTAssertEqual(CatalogOrganizer.featuredItem(in: [first, earlier]), earlier)
        XCTAssertNil(CatalogOrganizer.featuredItem(in: []))
    }

    private func makeItem(id: Int, sortOrder: Int, featured: Bool) -> MediaItem {
        MediaItem(
            id: id,
            title: "Synthetic item \(id)",
            year: 2000,
            description: "Synthetic description",
            category: "OTHERS",
            posterURL: "fixture://poster-\(id)",
            sortOrder: sortOrder,
            featured: featured
        )
    }
}
