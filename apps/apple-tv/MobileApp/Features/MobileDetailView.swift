import SwiftUI
import LeliBrambasCore

struct MobileDetailView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var progress: PlaybackProgressStore
    @Environment(\.mobileVariant) private var variant
    let item: MediaItem
    let profile: ViewerProfile
    let isActive: Bool
    @State private var session: PlaybackSession?
    @State private var relatedSeed = UUID()

    private var saved: PlaybackProgress? {
        _ = progress.revision
        return progress.progress(profileID: profile.id, movieID: item.id)
    }
    private var resume: PlaybackProgress? {
        progress.resumableProgress(profileID: profile.id, movieID: item.id)
    }
    private var duration: Double? { item.durationSeconds ?? saved?.durationSeconds }
    private var related: [MediaItem] {
        MobileCatalogue.related(to: item, in: MobileCatalogue.ordered(model.items), seed: relatedSeed)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                MobilePreviewArtwork(item: item, isActive: isActive && session == nil,
                                     delay: LBPreviewPolicy.delayNanoseconds,
                                     startSeconds: item.previewStartSeconds > 0
                                        ? item.previewStartSeconds : LBPreviewPolicy.targetStartSeconds)
                    .padding(.horizontal, variant == .cinema ? 0 : 20)
                VStack(alignment: .leading, spacing: 20) {
                    Text(item.title).font(.largeTitle.bold())
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("details-title")
                        .accessibilityAddTraits(.isHeader)
                    MobileMetadata(item: item, duration: duration)
                    if let availability = MobileCatalogue.availability(item) {
                        Label(availability, systemImage: "clock").foregroundStyle(LBColor.gold)
                    }
                    if let resume {
                        VStack(alignment: .leading, spacing: 8) {
                            ProgressView(value: min(1, resume.seconds / resume.durationSeconds))
                                .tint(LBColor.gold)
                                .accessibilityLabel("Playback progress")
                            Text("Resume at \(LBPlaybackProgressPolicy.timestamp(resume.seconds))")
                                .font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                    MobilePlayButton(item: item, profile: profile, session: $session)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if resume != nil && MobileCatalogue.canPlay(item) {
                        MobilePlayButton(item: item, profile: profile, startFromBeginning: true, session: $session)
                    }
                    Text(item.description.isEmpty ? "No description is available for this film." : item.description)
                        .font(.body).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Button {
                        guard let duration else { return }
                        progress.save(profileID: profile.id, movieID: item.id,
                                      seconds: duration, durationSeconds: duration, completed: true)
                    } label: {
                        Label(saved?.completed == true ? "Watched" : "Mark watched", systemImage: "checkmark")
                            .frame(minHeight: 32)
                    }
                    .buttonStyle(.bordered)
                    .disabled(duration == nil || saved?.completed == true)
                    .accessibilityHint(duration == nil ? "The film’s duration becomes available during playback." : "")
                    if !related.isEmpty {
                        Text("Related Movies").font(.title3.bold()).accessibilityAddTraits(.isHeader)
                        MobileMovieGrid(items: related)
                    }
                }.padding(.horizontal, 20)
            }
            .padding(.vertical, 16)
        }
        .background(Color.black)
        .navigationTitle(item.title)
        .navigationBarTitleDisplayMode(.inline)
        .fullScreenCover(item: $session) { MobilePlayerScreen(session: $0) }
        .accessibilityIdentifier("details-screen")
    }
}

struct MobilePlayButton: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var progress: PlaybackProgressStore
    let item: MediaItem
    let profile: ViewerProfile
    var startFromBeginning = false
    @Binding var session: PlaybackSession?
    @State private var isPreparing = false
    @State private var showsError = false

    private var start: Double {
        startFromBeginning ? 0 : (progress.resumableProgress(profileID: profile.id, movieID: item.id)?.seconds ?? 0)
    }

    var body: some View {
        Button {
            guard !isPreparing else { return }
            isPreparing = true
        } label: {
            HStack(spacing: 10) {
                if isPreparing { ProgressView().tint(.black) }
                else { Image(systemName: startFromBeginning ? "arrow.counterclockwise" : "play.fill") }
                Text(isPreparing ? "Preparing…" : (startFromBeginning ? "Restart" : (start > 0 ? "Resume" : "Play")))
                    .fontWeight(.semibold)
            }.frame(minHeight: 32)
        }
        .buttonStyle(.borderedProminent)
        .foregroundStyle(.black)
        .disabled(!MobileCatalogue.canPlay(item) || isPreparing)
        .accessibilityIdentifier(startFromBeginning ? "details-restart" : "details-play")
        .task(id: isPreparing) {
            guard isPreparing else { return }
            defer { isPreparing = false }
            let prepared = await model.preparePlayback(for: item, startSeconds: start, profileID: profile.id)
            guard !Task.isCancelled else { return }
            if let prepared { session = prepared }
            else { showsError = true }
        }
        .alert("Playback unavailable", isPresented: $showsError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("This film could not be opened. Please try again.")
        }
    }
}
