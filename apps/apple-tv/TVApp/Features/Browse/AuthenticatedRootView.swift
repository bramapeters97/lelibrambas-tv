import LeliBrambasCore
import SwiftUI

enum BrowseSection: String, CaseIterable, Identifiable, Hashable {
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
        case .library: return "Full Library"
        case .settings: return "Settings"
        }
    }

    var iconAssetName: String? {
        switch self {
        case .home: return "WebNavHome"
        case .search: return "WebNavSearch"
        case .collections: return "WebNavCollections"
        case .library: return "WebNavLibrary"
        case .settings: return nil
        }
    }
}

enum BrowseRoute: Hashable {
    case details(Int)
}

struct BrowseRootView: View {
    @ObservedObject var model: AppModel
    let profile: ViewerProfile
    let onSwitchProfile: () -> Void

    @State private var section: BrowseSection = .home
    @State private var path: [BrowseRoute] = []
    @State private var playbackSession: PlaybackSession?
    @State private var isPreparingPlayback = false
    @State private var selectedCollectionID: String?

    init(model: AppModel, profile: ViewerProfile, onSwitchProfile: @escaping () -> Void) {
        self.model = model
        self.profile = profile
        self.onSwitchProfile = onSwitchProfile
#if DEBUG
        switch DebugLaunchOptions.screenshotScreen {
        case "search":
            _section = State(initialValue: .search)
        case "library":
            _section = State(initialValue: .library)
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
                    onSwitchProfile: onSwitchProfile,
                    prefersSelectedItemFocus: section == .settings
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
                preparePreview: { await model.preparePreview(for: $0) },
                onPlay: preparePlayback,
                onSelect: { path.append(.details($0.id)) },
                onOpenCollection: showCollection
            )
        case .search:
            SearchView(items: model.items) { path.append(.details($0.id)) }
        case .collections:
            CollectionsView(
                sections: model.sections,
                initialSelectionID: selectedCollectionID
            ) { path.append(.details($0.id)) }
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

    private func showCollection(_ collection: CatalogSection) {
        selectedCollectionID = collection.id
        path.removeAll()
        section = .collections
    }
}

private struct MainNavigationRail: View {
    let selection: BrowseSection
    let profile: ViewerProfile
    let onSelect: (BrowseSection) -> Void
    let onSwitchProfile: () -> Void
    let prefersSelectedItemFocus: Bool

    @FocusState private var focusedSection: BrowseSection?

    var body: some View {
        VStack(spacing: 9) {
            LBLogo(size: 46)
                .padding(.bottom, 17)
            ForEach(BrowseSection.allCases) { item in
                NavigationRailButton(item: item, selected: item == selection) {
                    onSelect(item)
                }
                .focused($focusedSection, equals: item)
            }
            Spacer(minLength: 12)
            ProfileRailButton(profile: profile, action: onSwitchProfile)
        }
        .padding(.top, 32)
        .padding(.bottom, 26)
        .frame(width: LBLayout.navigationWidth)
        .frame(maxHeight: .infinity)
        .background {
            LinearGradient(
                colors: [LBColor.canvas.opacity(0.98), LBColor.canvas.opacity(0.84)],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
        .overlay(alignment: .trailing) {
            Rectangle().fill(LBColor.text.opacity(0.06)).frame(width: 1)
        }
        .focusSection()
        .defaultFocus($focusedSection, prefersSelectedItemFocus ? selection : nil)
        .task(id: selection) {
            guard prefersSelectedItemFocus else { return }
            await Task.yield()
            focusedSection = selection
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
            HStack(spacing: 14) {
                navigationIcon
                if isFocused {
                    Text(item.title)
                        .font(LBTypography.caption(size: 18, weight: .semibold))
                        .lineLimit(1)
                        .transition(.opacity)
                }
            }
            .padding(.leading, 14)
            .foregroundStyle(selected ? LBColor.text : LBColor.textMuted)
            .frame(width: isFocused ? 176 : 52, height: 47, alignment: .leading)
            .background(
                (isFocused ? LBColor.surfaceRaised : selected ? LBColor.text.opacity(0.09) : .clear),
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(isFocused ? LBColor.text : .clear, lineWidth: 3)
            }
            .offset(x: isFocused ? 52 : 0)
            .scaleEffect(isFocused ? 1.035 : 1)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(LBPlainButtonStyle())
        .focusEffectDisabled()
        .accessibilityLabel(item.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityIdentifier("nav-\(item.rawValue)")
    }

    @ViewBuilder
    private var navigationIcon: some View {
        if let assetName = item.iconAssetName {
            Image(assetName)
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 26, height: 26)
        } else {
            Image(systemName: "gearshape")
                .font(.system(size: 25, weight: .regular))
                .frame(width: 26, height: 26)
        }
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
                .font(LBTypography.caption(size: 14, weight: .bold))
                .foregroundStyle(LBColor.text)
                .frame(width: 44, height: 44)
                .background(LBColor.surfaceRaised, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(profile.accent, lineWidth: 2)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .stroke(isFocused ? LBColor.text : .clear, lineWidth: 3)
                        .padding(-4)
                }
                .scaleEffect(isFocused ? 1.055 : 1)
                .shadow(color: isFocused ? profile.accent.opacity(0.36) : .clear, radius: 15)
                .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(LBPlainButtonStyle())
        .focusEffectDisabled()
        .accessibilityLabel("Switch profile, currently \(profile.name)")
        .accessibilityIdentifier("switch-profile")
    }
}
