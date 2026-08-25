import LeliBrambasCore
import SwiftUI

struct HomeView: View {
    let featured: MediaItem?
    let sections: [CatalogSection]
    var startAtShelves = false
    let onPlay: (MediaItem) -> Void
    let onSelect: (MediaItem) -> Void

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
}
