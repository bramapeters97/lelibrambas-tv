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
            switch model.authenticationState {
            case .requesting:
                LBLoadingView(message: "Preparing secure activation…")
            case let .awaitingApproval(challenge):
                DeviceActivationView(
                    challenge: challenge,
                    isWorking: model.isWorking,
                    error: model.presentedError,
                    onStart: { Task { await model.beginActivation() } },
                    onCancel: model.cancelActivation
                )
            case let .authorized(session):
                if model.isLoadingCatalog {
                    LaunchView(message: "Opening the family archive…")
                } else if let error = model.presentedError, model.items.isEmpty {
                    LBErrorView(error: error) { Task { await model.reloadCatalog() } }
                } else if model.items.isEmpty {
                    LBEmptyState(
                        title: "The archive is quiet",
                        message: "No films are available for this account yet."
                    )
                } else {
                    AuthenticatedRootView(model: model, session: session)
                }
            case let .failed(failure):
                DeviceActivationView(
                    challenge: nil,
                    isWorking: model.isWorking,
                    error: AppError.authentication(failure),
                    onStart: { Task { await model.beginActivation() } },
                    onCancel: model.cancelActivation
                )
            case .signedOut:
                DeviceActivationView(
                    challenge: nil,
                    isWorking: model.isWorking,
                    error: model.presentedError,
                    onStart: { Task { await model.beginActivation() } },
                    onCancel: model.cancelActivation
                )
            }
        }
        .animation(LBMotion.standard, value: model.authenticationState)
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
