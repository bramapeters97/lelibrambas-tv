import LeliBrambasCore
import SwiftUI

enum LBHeroPreviewPolicy {
    static let delayNanoseconds: UInt64 = 2_000_000_000
    static let delaySeconds: Double = 2
    static let targetStartSeconds: Double = 40
}

struct HomeView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let featured: MediaItem?
    let items: [MediaItem]
    let sections: [CatalogSection]
    let profile: ViewerProfile
    @ObservedObject var progressStore: PlaybackProgressStore
    var startAtShelves = false
    let focusScope: Namespace.ID
    var prefersInitialFocus = true
    let preparePreview: (MediaItem) async -> URL?
    let onPlay: (MediaItem) -> Void
    let onSelect: (MediaItem) -> Void
    let onOpenCollection: (CatalogSection) -> Void

    @State private var heroPreviewURL: URL?
    @State private var previewRequestGeneration = 0

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 54) {
                    if let featured {
                        LBHero(
                            item: featured,
                            focusScope: focusScope,
                            previewURL: heroPreviewURL,
                            onPreviewStopped: { heroPreviewURL = nil },
                            onPlay: {
                                stopHeroPreview()
                                onPlay(featured)
                            },
                            onDetails: {
                                stopHeroPreview()
                                onSelect(featured)
                            },
                            prefersInitialFocus: prefersInitialFocus && !startAtShelves
                        )
                        .id("hero")
                    }
                    if !sections.isEmpty {
                        homeCollections
                    }
                    if let recentlyWatchedSection {
                        LBMediaShelf(section: recentlyWatchedSection, onSelect: onSelect)
                            .id("shelf-recently-watched")
                    }
                    if let trendingSection {
                        LBMediaShelf(section: trendingSection, onSelect: onSelect)
                            .id("shelf-currently-trending")
                    }
                    ForEach(sections) { section in
                        LBMediaShelf(section: section, onSelect: onSelect)
                            .id("shelf-\(section.id)")
                    }
                    if let allMoviesSection {
                        allMoviesGrid(allMoviesSection)
                            .id("shelf-all-movies")
                    }
                    Color.clear.frame(height: LBSpacing.safeVertical)
                }
            }
            .task(id: sections.first?.id) {
                guard startAtShelves, let first = sections.first else { return }
                await Task.yield()
                proxy.scrollTo("shelf-\(first.id)", anchor: .top)
            }
        }
        .task(id: featured?.id) {
            heroPreviewURL = nil
            previewRequestGeneration += 1
            let generation = previewRequestGeneration
            guard let featured, allowsAmbientPreview, !reduceMotion else { return }
            try? await Task.sleep(nanoseconds: LBHeroPreviewPolicy.delayNanoseconds)
            guard !Task.isCancelled, previewRequestGeneration == generation else { return }
            let preparedURL = await preparePreview(featured)
            guard !Task.isCancelled, previewRequestGeneration == generation else { return }
            heroPreviewURL = preparedURL
        }
        .onDisappear { stopHeroPreview() }
        .background(LBColor.canvas)
        .ignoresSafeArea(edges: .top)
        .accessibilityIdentifier("home-screen")
    }

    private var allowsAmbientPreview: Bool {
#if DEBUG
        !DebugLaunchOptions.fixtureMode
#else
        true
#endif
    }

    private func stopHeroPreview() {
        previewRequestGeneration += 1
        heroPreviewURL = nil
    }

    private var trendingSection: CatalogSection? {
        let items = items.filter(\.featured)
        guard !items.isEmpty else { return nil }
        return CatalogSection(id: "currently-trending", title: "Currently Trending", items: items)
    }

    private var recentlyWatchedSection: CatalogSection? {
        _ = progressStore.revision
        let recent = progressStore.recentlyWatched(profileID: profile.id, items: items)
        guard !recent.isEmpty else { return nil }
        return CatalogSection(id: "recently-watched", title: "Recently Watched", items: recent)
    }

    private var allMoviesSection: CatalogSection? {
        LBHomeContent.allMovies(from: items)
    }

    private var homeCollections: some View {
        VStack(alignment: .leading, spacing: 15) {
            LBSectionTitle(
                title: "Collections",
                icon: .collections,
                countText: "\(sections.count) folder categories"
            )
                .padding(.horizontal, LBSpacing.safeHorizontal)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 15) {
                    ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
                        LBCollectionCard(section: section, index: index, style: .compact) {
                            onOpenCollection(section)
                        }
                        .frame(width: 300)
                    }
                }
                .padding(.horizontal, LBSpacing.safeHorizontal)
                .padding(.vertical, 18)
            }
            .scrollClipDisabled()
            .focusSection()
        }
        .accessibilityIdentifier("home-collections")
    }

    private func allMoviesGrid(_ section: CatalogSection) -> some View {
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: LBSpacing.shelfGap, alignment: .top),
            count: 5
        )
        return VStack(alignment: .leading, spacing: 15) {
            LBSectionTitle(title: section.title, countText: "\(section.items.count) titles")
            LazyVGrid(columns: columns, alignment: .leading, spacing: 36) {
                ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                    LBMediaCard(item: item, width: 300, index: index) { onSelect(item) }
                }
            }
            .focusSection()
        }
        .padding(.horizontal, LBSpacing.safeHorizontal)
    }
}

enum LBHomeContent {
    static func allMovies(from items: [MediaItem]) -> CatalogSection? {
        var seenIDs = Set<Int>()
        let uniqueItems = items.filter { seenIDs.insert($0.id).inserted }
        guard !uniqueItems.isEmpty else { return nil }
        return CatalogSection(id: "all-movies", title: "All movies", items: uniqueItems)
    }
}
