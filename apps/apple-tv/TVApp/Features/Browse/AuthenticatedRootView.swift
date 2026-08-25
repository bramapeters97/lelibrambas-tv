import LeliBrambasCore
import SwiftUI

enum BrowseSection: String, CaseIterable, Identifiable {
    case home
    case search
    case collections
    case library
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "Home"
        case .search: return "Search"
        case .collections: return "Collections"
        case .library: return "Library"
        case .settings: return "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .home: return "house.fill"
        case .search: return "magnifyingglass"
        case .collections: return "square.grid.2x2.fill"
        case .library: return "film.stack.fill"
        case .settings: return "person.crop.circle.fill"
        }
    }
}

enum BrowseRoute: Hashable {
    case details(Int)
    case collection(String)
}

struct BrowseRootView: View {
    @ObservedObject var model: AppModel

    @State private var section: BrowseSection = .home
    @State private var path: [BrowseRoute] = []
    @State private var playbackSession: PlaybackSession?
    @State private var isPreparingPlayback = false

    init(model: AppModel) {
        self.model = model
#if DEBUG
        switch DebugLaunchOptions.screenshotScreen {
        case "details":
            _path = State(initialValue: [.details(1)])
        case "playback-ready":
            // A deterministic, meaningful feature view is safer for App Store capture
            // than a remote stream whose readiness depends on network timing.
            _section = State(initialValue: .collections)
        case "settings":
            _section = State(initialValue: .settings)
        case "shelves":
            _section = State(initialValue: .home)
        default:
            break
        }
#endif
    }

    var body: some View {
        ZStack {
            LBBackground()
            HStack(spacing: 0) {
                MainNavigationRail(
                    selection: section,
                    onSelect: selectSection
                )
                NavigationStack(path: $path) {
                    activeSection
                        .navigationDestination(for: BrowseRoute.self, destination: destination)
                        .toolbar(.hidden, for: .navigationBar)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .fullScreenCover(item: $playbackSession) { session in
            PlayerScreen(session: session) {
                playbackSession = nil
            }
        }
        .accessibilityIdentifier("browse-root")
    }

    @ViewBuilder
    private var activeSection: some View {
        switch section {
        case .home:
            HomeView(
                featured: CatalogOrganizer.featuredItem(in: model.items),
                sections: model.sections,
                startAtShelves: startsAtShelves,
                onPlay: preparePlayback,
                onSelect: { path.append(.details($0.id)) }
            )
        case .search:
            SearchView(items: model.items) { path.append(.details($0.id)) }
        case .collections:
            CollectionsView(sections: model.sections) { path.append(.collection($0.id)) }
        case .library:
            LibraryView(items: model.items) { path.append(.details($0.id)) }
        case .settings:
            SettingsView()
        }
    }

    private var startsAtShelves: Bool {
#if DEBUG
        DebugLaunchOptions.screenshotScreen == "shelves"
#else
        false
#endif
    }

    @ViewBuilder
    private func destination(_ route: BrowseRoute) -> some View {
        switch route {
        case let .details(id):
            if let item = model.items.first(where: { $0.id == id }) {
                MediaDetailView(
                    item: item,
                    model: model,
                    isPreparingPlayback: isPreparingPlayback,
                    onPlay: preparePlayback
                )
            } else {
                LBEmptyState(title: "Film not found", message: "This film is no longer in the available archive.")
            }
        case let .collection(id):
            if let collection = model.sections.first(where: { $0.id == id }) {
                CollectionDetailView(section: collection) { path.append(.details($0.id)) }
            } else {
                LBEmptyState(title: "Collection not found", message: "This collection is no longer available.")
            }
        }
    }

    private func selectSection(_ newSection: BrowseSection) {
        guard section != newSection || !path.isEmpty else { return }
        path.removeAll()
        section = newSection
    }

    private func preparePlayback(_ item: MediaItem) {
        guard !isPreparingPlayback else { return }
        isPreparingPlayback = true
        Task {
            playbackSession = await model.preparePlayback(for: item)
            isPreparingPlayback = false
        }
    }
}

private struct MainNavigationRail: View {
    let selection: BrowseSection
    let onSelect: (BrowseSection) -> Void

    var body: some View {
        VStack(spacing: 18) {
            LBLogo(size: 58)
                .padding(.bottom, 28)
            ForEach(BrowseSection.allCases) { item in
                NavigationRailButton(item: item, selected: item == selection) {
                    onSelect(item)
                }
            }
            Spacer(minLength: 12)
        }
        .padding(.vertical, LBSpacing.safeVertical)
        .frame(width: LBLayout.navigationWidth)
        .frame(maxHeight: .infinity)
        .background(LBColor.canvas.opacity(0.93))
        .overlay(alignment: .trailing) {
            Rectangle().fill(LBColor.text.opacity(0.06)).frame(width: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Main navigation")
    }
}

private struct NavigationRailButton: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let item: BrowseSection
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 7) {
                Image(systemName: item.symbol)
                    .font(.system(size: 28, weight: .semibold))
                Text(item.title)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .lineLimit(1)
            }
            .foregroundStyle(selected ? LBColor.cyan : LBColor.textSecondary)
            .frame(width: 104, height: 76)
            .background(
                (isFocused || selected ? LBColor.surfaceRaised : .clear),
                in: RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
                    .stroke(isFocused ? LBColor.text : .clear, lineWidth: 3)
            }
            .scaleEffect(isFocused ? LBLayout.focusScale : 1)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("nav-\(item.rawValue)")
    }
}
