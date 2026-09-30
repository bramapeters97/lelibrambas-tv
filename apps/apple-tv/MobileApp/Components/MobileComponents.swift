import SwiftUI
import LeliBrambasCore

struct MobileArtwork: View {
    let item: MediaItem
    var backdrop = false

    var body: some View {
        Color.black
            .aspectRatio(16.0 / 9.0, contentMode: .fit)
            .overlay {
                if let url = RemoteArtworkResolver.remoteURL(
                    for: backdrop ? (item.backdropURL ?? item.posterURL) : item.posterURL
                ) {
                    LBRemoteArtwork(url: url, maximumPixelSize: backdrop ? 1_280 : 640,
                                    showsLoadingIndicator: true) {
                        fallback
                    }
                } else {
                    fallback
                }
            }
            .clipped()
            .accessibilityHidden(true)
    }

    private var fallback: some View {
        ZStack {
            Color.white.opacity(0.045)
            Image(systemName: "film")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct MobileMovieCard: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    let item: MediaItem

    var body: some View {
        NavigationLink(value: MobileRoute.movie(item.id)) {
            VStack(alignment: .leading, spacing: 8) {
                MobileArtwork(item: item)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .opacity(MobileCatalogue.canPlay(item) ? 1 : 0.58)
                Text(item.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white)
                    .lineLimit(typeSize.isAccessibilitySize ? nil : 2)
                    .fixedSize(horizontal: false, vertical: true)
                if let availability = MobileCatalogue.availability(item) {
                    Text(availability).font(.caption).foregroundStyle(LBColor.gold)
                } else if let year = item.year {
                    Text(String(year)).font(.caption).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(MobilePressedStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([item.title, item.year.map(String.init),
                             MobileCatalogue.availability(item)].compactMap { $0 }.joined(separator: ", "))
        .accessibilityHint("Open film details")
        .accessibilityIdentifier("movie-\(item.id)")
    }
}

struct MobilePressedStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.65 : 1)
    }
}

struct MobileMovieGrid: View {
    @Environment(\.mobileVariant) private var variant
    @Environment(\.dynamicTypeSize) private var typeSize
    let items: [MediaItem]

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: typeSize.isAccessibilitySize ? 280 : variant.gridMinimum),
                                    spacing: 12, alignment: .top)],
                  alignment: .leading, spacing: 24) {
            ForEach(items) { MobileMovieCard(item: $0) }
        }
    }
}

struct MobileShelf: View {
    @Environment(\.mobileVariant) private var variant
    @Environment(\.dynamicTypeSize) private var typeSize
    let title: String
    let items: [MediaItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.title3.bold()).accessibilityAddTraits(.isHeader)
                .padding(.horizontal, 20)
            if variant == .compact {
                MobileMovieGrid(items: items).padding(.horizontal, 20)
            } else {
                ScrollView(.horizontal) {
                    LazyHStack(alignment: .top, spacing: 12) {
                        ForEach(items) { item in
                            MobileMovieCard(item: item)
                                .containerRelativeFrame(.horizontal, count: 5,
                                                        span: variant == .cinema || typeSize.isAccessibilitySize ? 4 : 2,
                                                        spacing: 12)
                        }
                    }
                    .scrollTargetLayout()
                }
                .contentMargins(.horizontal, 20, for: .scrollContent)
                .scrollTargetBehavior(.viewAligned)
                .scrollIndicators(.hidden)
            }
        }
    }
}

struct MobileCatalogStatus: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if model.isLoadingCatalog && model.items.isEmpty {
                ProgressView("Opening the archive…").tint(.white)
                    .frame(maxWidth: .infinity, minHeight: 220)
            } else if let error = model.presentedError {
                VStack(spacing: 16) {
                    Label(error.title, systemImage: "wifi.exclamationmark").font(.headline)
                    Text(error.message).foregroundStyle(.secondary)
                    Button("Try again") { Task { await model.reloadCatalog() } }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.isLoadingCatalog)
                        .frame(minHeight: 44)
                }
                .multilineTextAlignment(.center).padding(24)
                .accessibilityIdentifier("catalog-error")
            } else if model.items.isEmpty {
                ContentUnavailableView("The archive is quiet", systemImage: "film",
                                       description: Text("No films are available yet."))
            }
        }
    }
}

struct MobileMetadata: View {
    let item: MediaItem
    var duration: Double? = nil

    var body: some View {
        Text(values.joined(separator: " · "))
            .font(.subheadline)
            .foregroundStyle(LBColor.gold)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var values: [String] {
        var values = [item.year.map(String.init), item.category].compactMap { $0 }
        if let duration = duration ?? item.durationSeconds, duration.isFinite, duration > 0 {
            values.append("\(Int((duration / 60).rounded())) min")
        }
        return values
    }
}
