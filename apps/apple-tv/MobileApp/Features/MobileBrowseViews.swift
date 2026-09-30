import SwiftUI
import LeliBrambasCore

struct MobileSearchView: View {
    @EnvironmentObject private var model: AppModel
    @State private var query = ""

    private var results: [MediaItem] {
        LBSearchIndex.results(in: MobileCatalogue.ordered(model.items), query: query)
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                MobileCatalogStatus()
                if !model.items.isEmpty {
                    if results.isEmpty {
                        ContentUnavailableView.search(text: query)
                    } else {
                        Text(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                             ? "Explore the archive" : "\(results.count) results")
                            .font(.headline).accessibilityAddTraits(.isHeader)
                        MobileMovieGrid(items: results)
                    }
                }
            }.padding(20)
        }
        .background(Color.black)
        .navigationTitle("Search")
        .searchable(text: $query, prompt: "Title, year or category")
        .autocorrectionDisabled()
        .textInputAutocapitalization(.never)
        .scrollDismissesKeyboard(.interactively)
        .refreshable { if !model.isLoadingCatalog { await model.reloadCatalog() } }
        .accessibilityIdentifier("search-screen")
    }
}

struct MobileCollectionsView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.dynamicTypeSize) private var typeSize

    private var sections: [CatalogSection] {
        CatalogOrganizer.sectionsPreservingItemOrder(from: MobileCatalogue.ordered(model.items))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                MobileCatalogStatus()
                NavigationLink(value: MobileRoute.library) {
                    Label("All movies", systemImage: "film")
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                }
                ForEach(sections) { section in
                    NavigationLink(value: MobileRoute.collection(section.id)) {
                        VStack(alignment: .leading, spacing: 12) {
                            if let cover = section.items.first {
                                MobileArtwork(item: cover).clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            Text(section.title).font(.title3.bold()).foregroundStyle(.white)
                            Text("\(section.items.count) films").font(.subheadline).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(MobilePressedStyle())
                    .accessibilityLabel("\(section.title), \(section.items.count) films")
                    .accessibilityHint("Open collection")
                }
            }.padding(20)
        }
        .background(Color.black)
        .navigationTitle("Collections")
        .refreshable { if !model.isLoadingCatalog { await model.reloadCatalog() } }
        .accessibilityIdentifier("collections-screen")
    }
}

struct MobileLibraryView: View {
    @EnvironmentObject private var model: AppModel
    let collectionID: String?

    private var section: CatalogSection? {
        CatalogOrganizer.sectionsPreservingItemOrder(from: MobileCatalogue.ordered(model.items))
            .first { $0.id == collectionID }
    }

    private var items: [MediaItem] {
        collectionID == nil ? MobileCatalogue.ordered(model.items) : (section?.items ?? [])
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                MobileCatalogStatus()
                if items.isEmpty && !model.items.isEmpty {
                    ContentUnavailableView("No films here yet", systemImage: "folder")
                } else {
                    Text("\(items.count) films").font(.subheadline).foregroundStyle(.secondary)
                    MobileMovieGrid(items: items)
                }
            }.padding(20)
        }
        .background(Color.black)
        .navigationTitle(collectionID == nil ? "All movies" : (section?.title ?? "Collection"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { if !model.isLoadingCatalog { await model.reloadCatalog() } }
    }
}
