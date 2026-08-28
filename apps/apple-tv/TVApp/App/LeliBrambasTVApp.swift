import AVFoundation
import SwiftUI
import UIKit

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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var model: AppModel
    @State private var selectedProfile: ViewerProfile?
    @State private var hasCompletedIntro = false
    @State private var introLifecycle = IntroLifecycleState()

    var body: some View {
        ZStack {
            LBBackground()
            if shouldPresentIntro {
                IntroSplashView(playsAudio: shouldPlayIntroAudio) {
                    hasCompletedIntro = true
                }
                .id(introLifecycle.cycleID)
                .transition(.opacity)
            } else if activeProfile == nil {
                ProfileSelectionView(profiles: ViewerProfile.all) { profile in
                    selectedProfile = profile
                }
                .transition(
                    .opacity.combined(with: .scale(scale: 0.982, anchor: .center))
                )
            } else if model.isLoadingCatalog {
                LaunchView(message: "Opening the family archive…")
            } else if let error = model.presentedError, model.items.isEmpty {
                LBErrorView(error: error) { Task { await model.reloadCatalog() } }
            } else if model.items.isEmpty {
                LBEmptyState(
                    title: "The archive is quiet",
                    message: "No films are available in the catalogue."
                )
            } else if let profile = activeProfile {
                BrowseRootView(
                    model: model,
                    profile: profile,
                    onSwitchProfile: { selectedProfile = nil }
                )
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.3), value: hasCompletedIntro)
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
        .onChange(of: scenePhase) { _, newPhase in
            guard introLifecycle.handle(newPhase) else { return }
            selectedProfile = nil
            hasCompletedIntro = false
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

    private var shouldPresentIntro: Bool {
#if DEBUG
        if DebugLaunchOptions.fixtureMode {
            return DebugLaunchOptions.screenshotScreen == "intro" && !hasCompletedIntro
        }
#endif
        return !hasCompletedIntro
    }

    private var shouldPlayIntroAudio: Bool {
#if DEBUG
        return !DebugLaunchOptions.fixtureMode
#else
        return true
#endif
    }
}

struct IntroLifecycleState {
    private(set) var requiresFreshIntro = false
    private(set) var cycleID = UUID()

    @discardableResult
    mutating func handle(_ scenePhase: ScenePhase) -> Bool {
        switch scenePhase {
        case .background:
            requiresFreshIntro = true
            return false
        case .active:
            guard requiresFreshIntro else { return false }
            requiresFreshIntro = false
            cycleID = UUID()
            return true
        case .inactive:
            return false
        @unknown default:
            return false
        }
    }
}

enum IntroPresentation {
    static let title = "LELIBRAMBAS+"
    static let subtitle = "A private family archive"
    static let accessibilityLabel = "LELIBRAMBAS+ private archive ident"
    static let jingleAssetName = "LaunchJingle"
    static let jingleVolume: Float = 0.68

    static let backgroundOnlyDelayNanoseconds: UInt64 = 1_000_000_000
    static let markDelayNanoseconds: UInt64 = 1_150_000_000
    static let copyDelayNanoseconds: UInt64 = 1_750_000_000
    static let animationCompletionDelayNanoseconds: UInt64 = 2_950_000_000
    static let finalHoldDelayNanoseconds: UInt64 = 3_000_000_000
    static let completionDelayNanoseconds: UInt64 = 6_950_000_000

    static let reducedMarkDelayNanoseconds: UInt64 = 120_000_000
    static let reducedCopyDelayNanoseconds: UInt64 = 240_000_000
    static let reducedAnimationCompletionDelayNanoseconds: UInt64 = 420_000_000
    static let reducedCompletionDelayNanoseconds: UInt64 = 4_420_000_000

    struct Light: Identifiable, Equatable {
        let id: Int
        let x: CGFloat
        let y: CGFloat
        let delay: Double
    }

    static let lights: [Light] = [
        Light(id: 1, x: 0.24, y: 0.22, delay: 0.05),
        Light(id: 2, x: 0.38, y: 0.18, delay: 0.15),
        Light(id: 3, x: 0.56, y: 0.19, delay: 0.25),
        Light(id: 4, x: 0.70, y: 0.26, delay: 0.12),
        Light(id: 5, x: 0.26, y: 0.39, delay: 0.30),
        Light(id: 6, x: 0.72, y: 0.41, delay: 0.38),
        Light(id: 7, x: 0.27, y: 0.58, delay: 0.20),
        Light(id: 8, x: 0.72, y: 0.60, delay: 0.45),
        Light(id: 9, x: 0.24, y: 0.78, delay: 0.38),
        Light(id: 10, x: 0.40, y: 0.79, delay: 0.50),
        Light(id: 11, x: 0.58, y: 0.78, delay: 0.58),
        Light(id: 12, x: 0.74, y: 0.72, delay: 0.28),
        Light(id: 13, x: 0.49, y: 0.28, delay: 0.65),
        Light(id: 14, x: 0.49, y: 0.43, delay: 0.42),
        Light(id: 15, x: 0.49, y: 0.57, delay: 0.52),
        Light(id: 16, x: 0.49, y: 0.71, delay: 0.62),
        Light(id: 17, x: 0.33, y: 0.49, delay: 0.75),
        Light(id: 18, x: 0.64, y: 0.49, delay: 0.70),
    ]

    static func intervals(reduceMotion: Bool) -> [UInt64] {
        if reduceMotion {
            return [
                backgroundOnlyDelayNanoseconds,
                reducedMarkDelayNanoseconds,
                reducedCopyDelayNanoseconds - reducedMarkDelayNanoseconds,
                reducedAnimationCompletionDelayNanoseconds - reducedCopyDelayNanoseconds,
                finalHoldDelayNanoseconds,
            ]
        }
        return [
            backgroundOnlyDelayNanoseconds,
            markDelayNanoseconds,
            copyDelayNanoseconds - markDelayNanoseconds,
            animationCompletionDelayNanoseconds - copyDelayNanoseconds,
            finalHoldDelayNanoseconds,
        ]
    }
}

enum IntroSequencePhase: Int, Equatable {
    case idle
    case lights
    case mark
    case copy
    case hold
    case completed
}

protocol IntroAudioPlaying: AnyObject {
    @discardableResult func play(volume: Float) -> Bool
    func stop()
}

final class BundledIntroAudioPlayer: IntroAudioPlaying {
    private let bundle: Bundle
    private let audioSession: AVAudioSession
    private var player: AVAudioPlayer?
    private var sessionIsActive = false

    init(bundle: Bundle = .main, audioSession: AVAudioSession = .sharedInstance()) {
        self.bundle = bundle
        self.audioSession = audioSession
    }

    static func resourceData(in bundle: Bundle = .main) -> Data? {
        NSDataAsset(name: IntroPresentation.jingleAssetName, bundle: bundle)?.data
    }

    @discardableResult
    func play(volume: Float) -> Bool {
        stop()
        guard let resourceData = Self.resourceData(in: bundle) else { return false }

        do {
            try audioSession.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)
            sessionIsActive = true

            let nextPlayer = try AVAudioPlayer(data: resourceData, fileTypeHint: AVFileType.mp3.rawValue)
            nextPlayer.volume = volume
            nextPlayer.numberOfLoops = 0
            nextPlayer.currentTime = 0
            nextPlayer.prepareToPlay()
            player = nextPlayer

            guard nextPlayer.play() else {
                stop()
                return false
            }
            return true
        } catch {
            stop()
            return false
        }
    }

    func stop() {
        player?.stop()
        player?.currentTime = 0
        player = nil
        if sessionIsActive {
            try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
            sessionIsActive = false
        }
    }
}

@MainActor
final class IntroSequenceModel: ObservableObject {
    typealias Sleeper = (UInt64) async throws -> Void

    @Published private(set) var phase: IntroSequencePhase = .idle
    private(set) var phaseHistory: [IntroSequencePhase] = [.idle]
    private(set) var runCount = 0

    private let audioPlayer: IntroAudioPlaying
    private let sleeper: Sleeper
    private var hasStarted = false
    private var deliveredCompletion = false
    private var cancellationRequested = false
    private var audioNeedsStopping = false

    init(
        audioPlayer: IntroAudioPlaying = BundledIntroAudioPlayer(),
        sleeper: @escaping Sleeper = { try await Task.sleep(nanoseconds: $0) }
    ) {
        self.audioPlayer = audioPlayer
        self.sleeper = sleeper
    }

    func run(
        reduceMotion: Bool,
        playAudio: Bool = true,
        onComplete: @escaping () -> Void
    ) async {
        guard !hasStarted, !cancellationRequested else { return }
        hasStarted = true
        runCount += 1

        defer {
            stopAudioIfNeeded()
        }

        let intervals = IntroPresentation.intervals(reduceMotion: reduceMotion)

        do {
            try await sleeper(intervals[0])
            guard !Task.isCancelled, !cancellationRequested else { return }

            if playAudio {
                _ = audioPlayer.play(volume: IntroPresentation.jingleVolume)
                audioNeedsStopping = true
            }
            transition(to: .lights)

            try await sleeper(intervals[1])
            guard !Task.isCancelled, !cancellationRequested else { return }
            transition(to: .mark)

            try await sleeper(intervals[2])
            guard !Task.isCancelled, !cancellationRequested else { return }
            transition(to: .copy)

            try await sleeper(intervals[3])
            guard !Task.isCancelled, !cancellationRequested else { return }
            transition(to: .hold)

            try await sleeper(intervals[4])
            guard !Task.isCancelled, !cancellationRequested else { return }
        } catch {
            return
        }

        transition(to: .completed)
        guard !deliveredCompletion else { return }
        deliveredCompletion = true
        onComplete()
    }

    func cancel() {
        cancellationRequested = true
        stopAudioIfNeeded()
    }

    func silenceAudio() {
        stopAudioIfNeeded()
    }

    private func transition(to nextPhase: IntroSequencePhase) {
        guard phase != nextPhase else { return }
        phase = nextPhase
        phaseHistory.append(nextPhase)
    }

    private func stopAudioIfNeeded() {
        guard audioNeedsStopping else { return }
        audioNeedsStopping = false
        audioPlayer.stop()
    }
}

struct IntroSplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var sequence = IntroSequenceModel()

    let playsAudio: Bool
    let onComplete: () -> Void

    init(playsAudio: Bool = true, onComplete: @escaping () -> Void) {
        self.playsAudio = playsAudio
        self.onComplete = onComplete
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                IntroBackground()

                IntroLightField(
                    visible: sequence.phase.rawValue >= IntroSequencePhase.lights.rawValue,
                    reduceMotion: reduceMotion
                )
                .frame(width: 420, height: 320)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2 - 50)

                IntroCinemaMark()
                    .frame(width: 176, height: 176)
                    .shadow(color: LBColor.gold.opacity(0.22), radius: 30)
                    .opacity(markIsVisible ? 1 : 0)
                    .scaleEffect(markIsVisible ? 1 : 0.92)
                    .animation(markAnimation, value: markIsVisible)
                    .position(x: proxy.size.width / 2, y: proxy.size.height / 2 - 48)
                    .accessibilityHidden(true)
                    .accessibilityIdentifier("intro-logo")

                VStack(spacing: 12) {
                    Text(IntroPresentation.title)
                        .font(LBTypography.display(size: 48, weight: .medium))
                        .tracking(5.76)
                        .foregroundStyle(LBColor.text)
                        .accessibilityIdentifier("intro-title")
                    Text(IntroPresentation.subtitle.uppercased())
                        .font(LBTypography.caption(size: 16, weight: .regular))
                        .tracking(5.76)
                        .foregroundStyle(LBColor.gold)
                        .accessibilityLabel(IntroPresentation.subtitle)
                        .accessibilityIdentifier("intro-subtitle")
                }
                .multilineTextAlignment(.center)
                .opacity(copyIsVisible ? 1 : 0)
                .offset(y: copyIsVisible ? 0 : 12)
                .animation(copyAnimation, value: copyIsVisible)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2 + 150)

                if sequence.phase == .hold {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(LBColor.gold)
                        .scaleEffect(1.2)
                        .position(x: proxy.size.width / 2, y: proxy.size.height / 2 + 236)
                        .transition(.opacity)
                        .accessibilityLabel("Loading")
                        .accessibilityIdentifier("intro-loader")
                }
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .ignoresSafeArea()
        .accessibilityElement(children: .contain)
        .accessibilityLabel(IntroPresentation.accessibilityLabel)
        .accessibilityIdentifier("intro-screen")
        .task(id: scenePhase == .background) {
            guard scenePhase != .background else { return }
            await sequence.run(
                reduceMotion: reduceMotion,
                playAudio: playsAudio,
                onComplete: onComplete
            )
        }
        .onChange(of: scenePhase) { _, newPhase in
            switch newPhase {
            case .background:
                sequence.cancel()
            case .inactive:
                sequence.silenceAudio()
            case .active:
                break
            @unknown default:
                sequence.silenceAudio()
            }
        }
    }

    private var markIsVisible: Bool {
        sequence.phase.rawValue >= IntroSequencePhase.mark.rawValue
    }

    private var copyIsVisible: Bool {
        sequence.phase.rawValue >= IntroSequencePhase.copy.rawValue
    }

    private var markAnimation: Animation? {
        reduceMotion
            ? .easeOut(duration: 0.18)
            : .timingCurve(0.25, 0.1, 0.25, 1, duration: 1)
    }

    private var copyAnimation: Animation? {
        reduceMotion
            ? .easeOut(duration: 0.18)
            : .timingCurve(0.25, 0.1, 0.25, 1, duration: 0.8)
    }
}

private struct IntroBackground: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LBColor.canvas
                RadialGradient(
                    stops: [
                        .init(color: Color(red: 11 / 255, green: 20 / 255, blue: 39 / 255), location: 0),
                        .init(color: LBColor.canvas, location: 0.66),
                        .init(color: LBColor.canvas, location: 1),
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.66
                )
                RadialGradient(
                    colors: [Color(red: 49 / 255, green: 83 / 255, blue: 137 / 255).opacity(0.22), .clear],
                    center: UnitPoint(x: 0.5, y: 0.47),
                    startRadius: 0,
                    endRadius: min(proxy.size.width, proxy.size.height) * 0.32
                )
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

private struct IntroLightField: View {
    let visible: Bool
    let reduceMotion: Bool

    var body: some View {
        ZStack {
            ForEach(IntroPresentation.lights) { light in
                Circle()
                    .fill(LBColor.gold)
                    .frame(width: 5, height: 5)
                    .shadow(color: LBColor.gold.opacity(0.58), radius: 16)
                    .opacity(visible ? 0.82 : 0)
                    .scaleEffect(visible ? 1 : 0.1)
                    .offset(x: visible ? 0 : -90, y: visible ? 0 : 50)
                    .position(x: light.x * 420, y: light.y * 320)
                    .animation(lightAnimation(delay: light.delay), value: visible)
            }
        }
        .accessibilityHidden(true)
    }

    private func lightAnimation(delay: Double) -> Animation? {
        if reduceMotion {
            return .easeOut(duration: 0.18)
        }
        return .timingCurve(0.25, 0.1, 0.25, 1, duration: 2.2).delay(delay)
    }
}

private struct IntroCinemaMark: View {
    var body: some View {
        Canvas { context, size in
            let scale = min(size.width, size.height) / 24
            let transform = CGAffineTransform(scaleX: scale, y: scale)
            let strokeStyle = StrokeStyle(
                lineWidth: 1.3 * scale,
                lineCap: .round,
                lineJoin: .round
            )

            context.stroke(
                bodyPath.applying(transform),
                with: .color(LBColor.gold.opacity(0.9)),
                style: strokeStyle
            )
            context.stroke(
                clapperPath.applying(transform),
                with: .color(LBColor.gold.opacity(0.9)),
                style: strokeStyle
            )
            context.stroke(
                playPath.applying(transform),
                with: .color(LBColor.gold.opacity(0.9)),
                style: strokeStyle
            )
        }
        .accessibilityHidden(true)
    }

    private var bodyPath: Path {
        var path = Path()
        path.move(to: CGPoint(x: 4, y: 8.5))
        path.addLine(to: CGPoint(x: 20, y: 8.5))
        path.addLine(to: CGPoint(x: 20, y: 18.3))
        path.addCurve(
            to: CGPoint(x: 18.2, y: 20),
            control1: CGPoint(x: 20, y: 19.3),
            control2: CGPoint(x: 19.2, y: 20)
        )
        path.addLine(to: CGPoint(x: 5.8, y: 20))
        path.addCurve(
            to: CGPoint(x: 4, y: 18.3),
            control1: CGPoint(x: 4.8, y: 20),
            control2: CGPoint(x: 4, y: 19.3)
        )
        path.closeSubpath()
        return path
    }

    private var clapperPath: Path {
        var path = Path()
        path.move(to: CGPoint(x: 4.7, y: 8.5))
        path.addLine(to: CGPoint(x: 6.7, y: 4))
        path.addLine(to: CGPoint(x: 19.8, y: 4))
        path.addLine(to: CGPoint(x: 18, y: 8.5))
        path.move(to: CGPoint(x: 9.4, y: 4))
        path.addLine(to: CGPoint(x: 7.4, y: 8.5))
        path.move(to: CGPoint(x: 14.8, y: 4))
        path.addLine(to: CGPoint(x: 12.8, y: 8.5))
        return path
    }

    private var playPath: Path {
        var path = Path()
        path.move(to: CGPoint(x: 10.2, y: 12))
        path.addLine(to: CGPoint(x: 14.9, y: 14.5))
        path.addLine(to: CGPoint(x: 10.2, y: 17))
        path.closeSubpath()
        return path
    }
}
