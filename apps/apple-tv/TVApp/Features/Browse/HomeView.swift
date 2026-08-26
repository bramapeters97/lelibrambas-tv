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
    let sections: [CatalogSection]
    var startAtShelves = false
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
                            prefersInitialFocus: !startAtShelves
                        )
                        .id("hero")
                    }
                    if !sections.isEmpty {
                        homeCollections
                    }
                    if let trendingSection {
                        LBMediaShelf(section: trendingSection, onSelect: onSelect)
                            .id("shelf-currently-trending")
                    }
                    ForEach(sections) { section in
                        LBMediaShelf(section: section, onSelect: onSelect)
                            .id("shelf-\(section.id)")
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
        let allItems = sections.flatMap(\.items)
        let trendingIDs = [22, 23, 7, 40]
        let items = trendingIDs.compactMap { id in
            allItems.first(where: { $0.id == id })
        }
        guard !items.isEmpty else { return nil }
        return CatalogSection(id: "currently-trending", title: "Currently Trending", items: items)
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
}
