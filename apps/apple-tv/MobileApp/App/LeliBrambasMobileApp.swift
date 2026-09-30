import SwiftUI

@main
struct LeliBrambasMobileApp: App {
    @StateObject private var model = makeModel()
    @StateObject private var progress = PlaybackProgressStore()

    var body: some Scene {
        WindowGroup {
            MobileRootView()
                .environmentObject(model)
                .environmentObject(progress)
                .environment(\.mobileVariant, .current)
                .preferredColorScheme(.dark)
                .tint(LBColor.gold)
                .task { await model.start() }
        }
    }

    @MainActor
    private static func makeModel() -> AppModel {
#if DEBUG
        if DebugLaunchOptions.fixtureMode {
            return AppModel(catalogLoader: FixtureCatalogLoader())
        }
#endif
        return AppModel(catalogLoader: MoviesAPICatalogLoader(includesEditorialMetadata: true))
    }
}

struct MobileRootView: View {
    @EnvironmentObject private var model: AppModel
    @State private var profile: ViewerProfile?
    @State private var selectedTab: MobileTab = .home
    @State private var homePath: [MobileRoute] = []
    @State private var searchPath: [MobileRoute] = []
    @State private var collectionsPath: [MobileRoute] = []
    @State private var profilePath: [MobileRoute] = []

    var body: some View {
        Group {
            if let profile {
                tabs(for: profile)
            } else {
                NavigationStack {
                    MobileProfileView(selected: nil, onSelect: selectProfile)
                }
            }
        }
        .background(Color.black.ignoresSafeArea())
    }

    private func tabs(for profile: ViewerProfile) -> some View {
        TabView(selection: $selectedTab) {
            NavigationStack(path: $homePath) {
                MobileHomeView(profile: profile, isActive: selectedTab == .home && homePath.isEmpty)
                    .navigationTitle("LELIBRAMBAS+")
                    .navigationBarTitleDisplayMode(.inline)
                    .navigationDestination(for: MobileRoute.self) { destination($0, profile: profile, tab: .home) }
            }
            .tabItem { Label("Home", systemImage: "house") }.tag(MobileTab.home)

            NavigationStack(path: $searchPath) {
                MobileSearchView()
                    .navigationDestination(for: MobileRoute.self) { destination($0, profile: profile, tab: .search) }
            }
            .tabItem { Label("Search", systemImage: "magnifyingglass") }.tag(MobileTab.search)

            NavigationStack(path: $collectionsPath) {
                MobileCollectionsView()
                    .navigationDestination(for: MobileRoute.self) { destination($0, profile: profile, tab: .collections) }
            }
            .tabItem { Label("Collections", systemImage: "square.grid.2x2") }.tag(MobileTab.collections)

            NavigationStack(path: $profilePath) {
                MobileProfileView(selected: profile, onSelect: selectProfile)
                    .navigationDestination(for: MobileRoute.self) { destination($0, profile: profile, tab: .profile) }
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }.tag(MobileTab.profile)
        }
    }

    @ViewBuilder
    private func destination(_ route: MobileRoute, profile: ViewerProfile, tab: MobileTab) -> some View {
        switch route {
        case .movie(let id):
            if let item = model.items.first(where: { $0.id == id }) {
                MobileDetailView(item: item, profile: profile, isActive: selectedTab == tab)
            } else {
                ContentUnavailableView("Film unavailable", systemImage: "film",
                                       description: Text("This film is no longer in the catalogue."))
            }
        case .collection(let id):
            MobileLibraryView(collectionID: id)
        case .library:
            MobileLibraryView(collectionID: nil)
        }
    }

    private func selectProfile(_ newProfile: ViewerProfile) {
        guard profile?.id != newProfile.id else { return }
        homePath = []
        searchPath = []
        collectionsPath = []
        profilePath = []
        selectedTab = .home
        profile = newProfile
    }
}
