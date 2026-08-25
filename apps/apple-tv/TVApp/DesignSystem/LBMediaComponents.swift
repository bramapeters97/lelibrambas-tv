import SwiftUI
import LeliBrambasCore

struct LBMediaCard: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let item: MediaItem
    var width = LBLayout.posterWidth
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 13) {
                LBArtwork(item: item, kind: .poster)
                    .frame(width: width, height: width / LBLayout.posterAspectRatio)
                    .clipShape(RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
                            .stroke(isFocused ? LBColor.text : LBColor.text.opacity(0.1), lineWidth: isFocused ? 4 : 1)
                    }
                    .shadow(color: isFocused ? LBColor.gold.opacity(0.34) : .black.opacity(0.35), radius: isFocused ? 26 : 13, y: 14)

                Text(item.title)
                    .font(.system(size: 23, weight: .semibold, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .lineLimit(1)
                if let year = item.year {
                    Text(String(year))
                        .font(.system(size: 19, weight: .medium, design: .rounded))
                        .foregroundStyle(LBColor.textMuted)
                }
            }
            .frame(width: width, alignment: .leading)
            .contentShape(Rectangle())
            .scaleEffect(isFocused ? LBLayout.focusScale : 1)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Open details")
        .accessibilityIdentifier("media-card-\(item.id)")
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
        VStack(alignment: .leading, spacing: LBSpacing.medium) {
            LBSectionTitle(title: section.title)
                .padding(.horizontal, LBSpacing.safeHorizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(alignment: .top, spacing: LBSpacing.shelfGap) {
                    ForEach(section.items) { item in
                        LBMediaCard(item: item) { onSelect(item) }
                    }
                }
                .padding(.horizontal, LBSpacing.safeHorizontal)
                .padding(.vertical, 22)
            }
            .scrollClipDisabled()
        }
        .accessibilityIdentifier("shelf-\(section.id)")
    }
}

struct LBHero: View {
    let item: MediaItem
    let onPlay: () -> Void
    let onDetails: () -> Void

    var body: some View {
        ZStack(alignment: .leading) {
            LBArtwork(item: item, kind: .backdrop)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            LBColor.heroSideScrim
            LBColor.heroScrim

            VStack(alignment: .leading, spacing: LBSpacing.medium) {
                Text("FEATURED FROM THE ARCHIVE")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .tracking(3.4)
                    .foregroundStyle(LBColor.gold)
                Text(item.title)
                    .font(.system(size: 68, weight: .heavy, design: .rounded))
                    .tracking(-1.4)
                    .foregroundStyle(LBColor.text)
                    .lineLimit(2)
                    .frame(maxWidth: 920, alignment: .leading)
                LBMetadataRow(values: [item.year.map(String.init), item.category].compactMap { $0 })
                Text(item.description.isEmpty ? "A film from the private family archive." : item.description)
                    .font(.system(size: 26, weight: .regular, design: .rounded))
                    .foregroundStyle(LBColor.textSecondary)
                    .lineSpacing(5)
                    .lineLimit(3)
                    .frame(maxWidth: 850, alignment: .leading)
                HStack(spacing: LBSpacing.medium) {
                    LBPrimaryButton(action: onPlay) {
                        Label("Play", systemImage: "play.fill")
                    }
                    .accessibilityIdentifier("hero-play")
                    LBSecondaryButton(action: onDetails) {
                        Label("More info", systemImage: "info.circle")
                    }
                    .accessibilityIdentifier("hero-details")
                }
            }
            .padding(.leading, LBSpacing.safeHorizontal)
            .padding(.top, 90)
            .padding(.bottom, 86)
        }
        .frame(height: 680)
        .clipped()
        .accessibilityIdentifier("home-hero")
    }
}
