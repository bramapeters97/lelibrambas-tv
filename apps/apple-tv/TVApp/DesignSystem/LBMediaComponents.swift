import LeliBrambasCore
import SwiftUI

enum LBContentSelection {
    static func hero(in items: [MediaItem]) -> MediaItem? {
        items.first { $0.title.caseInsensitiveCompare("Lelibrambas+ Trailer") == .orderedSame }
            ?? CatalogOrganizer.featuredItem(in: items)
    }
}

struct LBMediaCard: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let item: MediaItem
    var width = LBLayout.mediaCardWidth
    var index: Int?
    let action: () -> Void

    var body: some View {
        Button(action: action) { cardContent }
            .buttonStyle(LBPlainButtonStyle())
            .focusEffectDisabled()
            .accessibilityLabel(accessibilityLabel)
            .accessibilityHint("Open details")
            .accessibilityIdentifier("media-card-\(item.id)")
    }

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            artworkPanel
            cardCopy
        }
        .frame(width: width, alignment: .leading)
        .background(LBColor.surface)
        .clipShape(cardShape)
        .overlay { focusBorder }
        .scaleEffect(isFocused ? LBLayout.focusScale : 1)
        .shadow(
            color: isFocused ? LBColor.gold.opacity(0.24) : .black.opacity(0.3),
            radius: isFocused ? 24 : 15,
            y: 14
        )
        .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
    }

    private var artworkPanel: some View {
        ZStack(alignment: .bottomTrailing) {
            LBArtwork(item: item, kind: .poster)
                .frame(width: width, height: width / LBLayout.cardAspectRatio)
            LinearGradient(
                colors: [.clear, LBColor.canvas.opacity(0.34)],
                startPoint: .center,
                endPoint: .bottom
            )
            rankingOverlay
        }
    }

    private var cardCopy: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(item.title)
                .font(LBTypography.title(size: 18, weight: .semibold))
                .foregroundStyle(LBColor.text)
                .lineLimit(1)
            Text(metadata)
                .font(LBTypography.caption(size: 14, weight: .medium))
                .foregroundStyle(LBColor.textMuted)
                .lineLimit(1)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .frame(minWidth: width, maxWidth: width, minHeight: 68, alignment: .topLeading)
    }

    private var cardShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: LBRadius.small, style: .continuous)
    }

    private var focusBorder: some View {
        cardShape.stroke(
            isFocused ? LBColor.text : LBColor.text.opacity(0.09),
            lineWidth: isFocused ? 3 : 1
        )
    }

    @ViewBuilder
    private var rankingOverlay: some View {
        if let index {
            let rankingText = String(index + 1).leftPadded(to: 2)
            Text(rankingText)
                .font(LBTypography.display(size: 32, weight: .bold))
                .foregroundStyle(Color.white.opacity(0.25))
                .padding(.trailing, 12)
                .padding(.bottom, 2)
        }
    }

    private var metadata: String {
        guard let year = item.year else { return item.category }
        return "\(year)  -  \(item.category)"
    }

    private var accessibilityLabel: String {
        [item.title, item.year.map(String.init), item.category]
            .compactMap { $0 }
            .joined(separator: ", ")
    }
}

struct LBMediaShelf: View {
    let section: CatalogSection
    let onSelect: (MediaItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            LBSectionTitle(
                title: section.title,
                countText: "\(section.items.count) titles"
            )
                .padding(.horizontal, LBSpacing.safeHorizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: LBSpacing.shelfGap) {
                    ForEach(Array(section.items.enumerated()), id: \.element.id) { index, item in
                        LBMediaCard(item: item, index: index) { onSelect(item) }
                    }
                }
                .padding(.horizontal, LBSpacing.safeHorizontal)
                .padding(.vertical, 20)
            }
            .scrollClipDisabled()
            .focusSection()
        }
        .accessibilityIdentifier("shelf-\(section.id)")
    }
}

struct LBHero: View {
    private enum FocusTarget: Hashable {
        case play
        case details
    }

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let item: MediaItem
    let previewURL: URL?
    let onPreviewStopped: () -> Void
    let onPlay: () -> Void
    let onDetails: () -> Void
    var prefersInitialFocus = true

    @State private var previewIsPlaying = false
    @FocusState private var focusedAction: FocusTarget?

    var body: some View {
        ZStack(alignment: .leading) {
            heroBackground
            heroCopy
            pagination
        }
        .frame(height: 713)
        .clipped()
        .onChange(of: previewURL) { _, _ in previewIsPlaying = false }
        .onDisappear {
            previewIsPlaying = false
            onPreviewStopped()
        }
        .focusSection()
        .defaultFocus($focusedAction, prefersInitialFocus ? .play : nil)
        .task {
            guard prefersInitialFocus else { return }
            await Task.yield()
            focusedAction = .play
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.72), value: previewIsPlaying)
        .accessibilityIdentifier("home-hero")
    }

    private var heroBackground: some View {
        ZStack {
            heroArtwork
                .frame(width: 1420, height: 780)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
                .offset(x: 28)
                .saturation(0.88)
                .brightness(-0.13)
                .opacity(0.78)
                .mask {
                    RadialGradient(
                        colors: [.black, .black.opacity(0.92), .black.opacity(0.32), .clear],
                        center: UnitPoint(x: 0.7, y: 0.46),
                        startRadius: 120,
                        endRadius: 940
                    )
                }
            leadingScrim
            bottomScrim
        }
    }

    private var leadingScrim: some View {
        LinearGradient(
            stops: [
                .init(color: LBColor.canvas, location: 0),
                .init(color: LBColor.canvas.opacity(0.95), location: 0.18),
                .init(color: LBColor.canvas.opacity(0.5), location: 0.52),
                .init(color: .clear, location: 0.78),
            ],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    private var bottomScrim: some View {
        LinearGradient(
            stops: [
                .init(color: .clear, location: 0.58),
                .init(color: LBColor.canvas.opacity(0.82), location: 0.82),
                .init(color: LBColor.canvas, location: 1),
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    private var heroCopy: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(item.category.uppercased())
                .font(LBTypography.eyebrow(size: 17))
                .tracking(4.4)
                .foregroundStyle(LBColor.gold)
                .padding(.bottom, 18)

            heroTitle
                .lineLimit(1)
                .minimumScaleFactor(0.78)
                .frame(maxWidth: 930, alignment: .leading)

            LBMetadataRow(values: heroMetadata)
                .padding(.top, 22)

            Text(heroDescription)
                .font(LBTypography.body(size: 23))
                .foregroundStyle(LBColor.textSecondary)
                .lineSpacing(6)
                .lineLimit(3)
                .frame(maxWidth: 790, alignment: .leading)
                .padding(.top, 20)

            heroActions
                .padding(.top, 28)
        }
        .padding(.leading, LBSpacing.safeHorizontal)
        .padding(.top, 74)
        .padding(.bottom, 72)
    }

    private var heroActions: some View {
        HStack(spacing: 18) {
            LBPrimaryButton(action: onPlay) {
                Text("Play Trailer")
            }
            .focused($focusedAction, equals: .play)
            .accessibilityIdentifier("hero-play")
            LBSecondaryButton(action: onDetails) {
                Text("More information")
            }
            .focused($focusedAction, equals: .details)
            .accessibilityIdentifier("hero-details")
        }
    }

    private var pagination: some View {
        HStack(spacing: 8) {
            Capsule().fill(Color.white).frame(width: 30, height: 7)
            Circle().fill(Color.white.opacity(0.3)).frame(width: 7, height: 7)
            Circle().fill(Color.white.opacity(0.3)).frame(width: 7, height: 7)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        .padding(.trailing, 70)
        .padding(.bottom, 42)
    }

    private var heroMetadata: [String] {
        [item.year.map(String.init), item.category, item.category].compactMap { $0 }
    }

    private var heroDescription: String {
        item.description.isEmpty ? "A film from the private family archive." : item.description
    }

    private var heroArtwork: some View {
        ZStack {
            LBStudioArtwork()
                .opacity(previewIsPlaying ? 0 : 1)

            if let previewURL {
                LBMutedPreview(
                    url: previewURL,
                    targetStartSeconds: LBHeroPreviewPolicy.targetStartSeconds,
                    onPlaying: { previewIsPlaying = true },
                    onStopped: {
                        previewIsPlaying = false
                        onPreviewStopped()
                    }
                )
                .opacity(previewIsPlaying ? 1 : 0)
                .id(previewURL)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var heroTitle: Text {
        Text("LELIBRAMBAS")
            .foregroundColor(LBColor.text)
            .font(LBTypography.display(size: 90, weight: .heavy))
        + Text("+")
            .foregroundColor(LBColor.cyan)
            .font(LBTypography.display(size: 90, weight: .black))
        + Text(" Trailer")
            .foregroundColor(LBColor.text)
            .font(LBTypography.display(size: 90, weight: .heavy))
    }
}

private extension String {
    func leftPadded(to length: Int) -> String {
        String(repeating: "0", count: max(0, length - count)) + self
    }
}
