import SwiftUI
import LeliBrambasCore

struct MobileHomeView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var progress: PlaybackProgressStore
    @Environment(\.mobileVariant) private var variant
    let profile: ViewerProfile
    let isActive: Bool

    private var items: [MediaItem] { MobileCatalogue.ordered(model.items) }
    private var sections: [CatalogSection] { CatalogOrganizer.sectionsPreservingItemOrder(from: items) }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: variant.sectionSpacing) {
                MobileCatalogStatus()
                if let hero = LBContentSelection.hero(in: items) {
                    MobileHero(item: hero, profile: profile, isActive: isActive)
                }
                if !sections.isEmpty { collectionLinks }
                if !recent.isEmpty {
                    MobileShelf(title: "Recently Watched", items: recent)
                }
                if items.contains(where: \.featured) {
                    MobileShelf(title: "Currently Trending", items: items.filter(\.featured))
                }
                ForEach(sections) { section in
                    MobileShelf(title: section.title, items: section.items)
                }
                if !items.isEmpty {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("All movies").font(.title3.bold()).accessibilityAddTraits(.isHeader)
                        MobileMovieGrid(items: items)
                    }.padding(.horizontal, 20)
                }
            }
            .padding(.bottom, 24)
        }
        .background(Color.black)
        .refreshable { if !model.isLoadingCatalog { await model.reloadCatalog() } }
        .accessibilityIdentifier("home-screen")
    }

    private var recent: [MediaItem] {
        _ = progress.revision
        return progress.recentlyWatched(profileID: profile.id, items: items)
    }

    private var collectionLinks: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 12) {
                ForEach(sections) { section in
                    NavigationLink(value: MobileRoute.collection(section.id)) {
                        Label(section.title, systemImage: "folder")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 12)
                            .frame(minHeight: 48)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .contentMargins(.horizontal, 20, for: .scrollContent)
        .scrollIndicators(.hidden)
        .accessibilityIdentifier("home-collections")
    }
}

private struct MobileHero: View {
    @Environment(\.mobileVariant) private var variant
    @Environment(\.dynamicTypeSize) private var typeSize
    let item: MediaItem
    let profile: ViewerProfile
    let isActive: Bool
    @State private var session: PlaybackSession?

    var body: some View {
        Group {
            if variant == .compact && !typeSize.isAccessibilitySize {
                HStack(alignment: .top, spacing: 16) {
                    MobilePreviewArtwork(item: item, isActive: isActive && session == nil,
                                         delay: 2_000_000_000, startSeconds: 40)
                        .frame(width: 120)
                    copy
                }.padding(20)
            } else if variant == .cinema && !typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 20) {
                    MobilePreviewArtwork(item: item, isActive: isActive && session == nil,
                                         delay: 2_000_000_000, startSeconds: 40)
                    copy.padding(.horizontal, 20)
                }
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    MobilePreviewArtwork(item: item, isActive: isActive && session == nil,
                                         delay: 2_000_000_000, startSeconds: 40)
                    copy
                }.padding(.horizontal, 20).padding(.top, 12)
            }
        }
        .fullScreenCover(item: $session) { session in
            MobilePlayerScreen(session: session)
        }
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("LELIBRAMBAS+").font(.caption.weight(.bold)).tracking(2).foregroundStyle(LBColor.gold)
            Text(item.title).font(variant == .compact ? .title2.bold() : .largeTitle.bold())
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            MobileMetadata(item: item)
            if variant != .compact {
                Text(item.description).font(.body).foregroundStyle(.secondary).lineLimit(3)
            }
            if let availability = MobileCatalogue.availability(item) {
                Text(availability).foregroundStyle(LBColor.gold)
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) { actions }
                VStack(alignment: .leading, spacing: 12) { actions }
            }
        }
    }

    @ViewBuilder private var actions: some View {
        MobilePlayButton(item: item, profile: profile, session: $session)
        NavigationLink(value: MobileRoute.movie(item.id)) {
            Label("Details", systemImage: "info.circle").frame(minHeight: 30)
        }.buttonStyle(.bordered)
    }
}
