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
        case .settings: return "gearshape.fill"
        }
    }
}

enum BrowseRoute: Hashable {
    case details(Int)
    case collection(String)
}

struct BrowseRootView: View {
    @ObservedObject var model: AppModel
    let profile: ViewerProfile
    let onSwitchProfile: () -> Void

    @State private var section: BrowseSection = .home
    @State private var path: [BrowseRoute] = []
    @State private var playbackSession: PlaybackSession?
    @State private var isPreparingPlayback = false

    init(model: AppModel, profile: ViewerProfile, onSwitchProfile: @escaping () -> Void) {
        self.model = model
        self.profile = profile
        self.onSwitchProfile = onSwitchProfile
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
                    profile: profile,
                    onSelect: selectSection,
                    onSwitchProfile: onSwitchProfile
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
                featured: LBContentSelection.hero(in: model.items),
                sections: model.sections,
                startAtShelves: startsAtShelves,
                onPlay: preparePlayback,
                onSelect: { path.append(.details($0.id)) },
                onOpenCollection: { path.append(.collection($0.id)) }
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
    let profile: ViewerProfile
    let onSelect: (BrowseSection) -> Void
    let onSwitchProfile: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            LBLogo(size: 48)
                .padding(.bottom, 18)
            ForEach(BrowseSection.allCases) { item in
                NavigationRailButton(item: item, selected: item == selection) {
                    onSelect(item)
                }
            }
            Spacer(minLength: 12)
            ProfileRailButton(profile: profile, action: onSwitchProfile)
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
        .zIndex(20)
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
            HStack(spacing: 15) {
                Image(systemName: item.symbol)
                    .font(.system(size: 25, weight: .medium))
                    .frame(width: 28)
                if isFocused {
                    Text(item.title)
                        .font(LBTypography.caption(size: 18, weight: .semibold))
                        .lineLimit(1)
                        .transition(.opacity)
                }
            }
            .padding(.leading, 18)
            .foregroundStyle(selected ? LBColor.text : LBColor.textMuted)
            .frame(width: isFocused ? 176 : 60, height: 58, alignment: .leading)
            .background(
                (isFocused ? LBColor.surfaceRaised : selected ? LBColor.text.opacity(0.09) : .clear),
                in: RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
                    .stroke(isFocused ? LBColor.text : .clear, lineWidth: 3)
            }
            .offset(x: isFocused ? 42 : 0)
            .scaleEffect(isFocused ? 1.03 : 1)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(.plain)
        .focusEffectDisabled()
        .accessibilityLabel(item.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("nav-\(item.rawValue)")
    }
}

private struct ProfileRailButton: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let profile: ViewerProfile
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(profile.initials)
                .font(LBTypography.caption(size: 17, weight: .bold))
                .foregroundStyle(LBColor.text)
                .frame(width: 46, height: 46)
                .background(LBColor.surfaceRaised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(profile.accent, lineWidth: isFocused ? 4 : 2)
                }
                .scaleEffect(isFocused ? 1.06 : 1)
                .shadow(color: isFocused ? profile.accent.opacity(0.36) : .clear, radius: 15)
                .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(.plain)
        .focusEffectDisabled()
        .accessibilityLabel("Switch profile, currently \(profile.name)")
        .accessibilityIdentifier("switch-profile")
    }
}
