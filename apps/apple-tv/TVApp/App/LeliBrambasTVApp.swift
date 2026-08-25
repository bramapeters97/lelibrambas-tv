import SwiftUI

@main
struct LeliBrambasTVApp: App {
    @StateObject private var model = AppModel.bootstrap()

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
                .preferredColorScheme(.dark)
                .task { await model.start() }
        }
    }
}

private struct RootView: View {
    @ObservedObject var model: AppModel
    @State private var selectedProfile: ViewerProfile?

    var body: some View {
        ZStack {
            LBBackground()
            if activeProfile == nil {
                ProfileSelectionView(profiles: ViewerProfile.all) { profile in
                    selectedProfile = profile
                }
            } else if model.isLoadingCatalog {
                LaunchView(message: "Opening the family archive…")
            } else if let error = model.presentedError, model.items.isEmpty {
                LBErrorView(error: error) { Task { await model.reloadCatalog() } }
            } else if model.items.isEmpty {
                LBEmptyState(
                    title: "The archive is quiet",
                    message: "No films are available in the bundled catalogue."
                )
            } else if let profile = activeProfile {
                BrowseRootView(
                    model: model,
                    profile: profile,
                    onSwitchProfile: { selectedProfile = nil }
                )
            }
        }
        .animation(LBMotion.standard, value: model.isLoadingCatalog)
        .alert(
            "Playback unavailable",
            isPresented: $model.showPlaybackError,
            presenting: model.playbackError
        ) { _ in
            Button("OK", role: .cancel) {}
        } message: { error in
            Text(error.message)
        }
    }

    private var activeProfile: ViewerProfile? {
        if let selectedProfile { return selectedProfile }
#if DEBUG
        if DebugLaunchOptions.fixtureMode, DebugLaunchOptions.screenshotScreen != "profiles" {
            return ViewerProfile.all.first
        }
#endif
        return nil
    }
}
