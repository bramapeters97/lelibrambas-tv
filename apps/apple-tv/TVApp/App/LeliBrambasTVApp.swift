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

    var body: some View {
        ZStack {
            LBBackground()
            if model.isLoadingCatalog {
                LaunchView(message: "Opening the family archive…")
            } else if let error = model.presentedError, model.items.isEmpty {
                LBErrorView(error: error) { Task { await model.reloadCatalog() } }
            } else if model.items.isEmpty {
                LBEmptyState(
                    title: "The archive is quiet",
                    message: "No films are available in the bundled catalogue."
                )
            } else {
                BrowseRootView(model: model)
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
}
