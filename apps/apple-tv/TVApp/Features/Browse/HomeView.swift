import LeliBrambasCore
import SwiftUI

struct HomeView: View {
    let featured: MediaItem?
    let sections: [CatalogSection]
    var startAtShelves = false
    let onPlay: (MediaItem) -> Void
    let onSelect: (MediaItem) -> Void
    let onOpenCollection: (CatalogSection) -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 54) {
                    if let featured {
                        LBHero(
                            item: featured,
                            onPlay: { onPlay(featured) },
                            onDetails: { onSelect(featured) }
                        )
                        .id("hero")
                    }
                    if !sections.isEmpty {
                        homeCollections
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
        .ignoresSafeArea(edges: .top)
        .accessibilityIdentifier("home-screen")
    }

    private var homeCollections: some View {
        VStack(alignment: .leading, spacing: 15) {
            LBSectionTitle(title: "Collections")
                .padding(.horizontal, LBSpacing.safeHorizontal)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 24) {
                    ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
                        LBCollectionCard(section: section, index: index, style: .compact) {
                            onOpenCollection(section)
                        }
                        .frame(width: 340)
                    }
                }
                .padding(.horizontal, LBSpacing.safeHorizontal)
                .padding(.vertical, 18)
            }
            .scrollClipDisabled()
        }
        .accessibilityIdentifier("home-collections")
    }
}
