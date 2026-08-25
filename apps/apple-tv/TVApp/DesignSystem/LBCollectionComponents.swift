import LeliBrambasCore
import SwiftUI

enum LBCollectionCardStyle {
    case compact
    case full
}

struct LBCollectionPalette {
    let start: Color
    let end: Color
    let accent: Color

    static func palette(at index: Int) -> LBCollectionPalette {
        switch index % 4 {
        case 0:
            return LBCollectionPalette(
                start: Color(red: 36 / 255, green: 26 / 255, blue: 34 / 255),
                end: Color(red: 110 / 255, green: 74 / 255, blue: 62 / 255),
                accent: LBColor.gold
            )
        case 1:
            return LBCollectionPalette(
                start: Color(red: 16 / 255, green: 33 / 255, blue: 61 / 255),
                end: Color(red: 37 / 255, green: 113 / 255, blue: 138 / 255),
                accent: Color(red: 215 / 255, green: 177 / 255, blue: 106 / 255)
            )
        case 2:
            return LBCollectionPalette(
                start: Color(red: 49 / 255, green: 25 / 255, blue: 39 / 255),
                end: Color(red: 155 / 255, green: 78 / 255, blue: 85 / 255),
                accent: Color(red: 240 / 255, green: 197 / 255, blue: 139 / 255)
            )
        default:
            return LBCollectionPalette(
                start: Color(red: 19 / 255, green: 43 / 255, blue: 43 / 255),
                end: Color(red: 65 / 255, green: 124 / 255, blue: 106 / 255),
                accent: Color(red: 213 / 255, green: 190 / 255, blue: 124 / 255)
            )
        }
    }

    static func homePalette(at index: Int) -> LBCollectionPalette {
        switch index % 4 {
        case 0:
            return LBCollectionPalette(
                start: Color(red: 18 / 255, green: 31 / 255, blue: 56 / 255),
                end: Color(red: 28 / 255, green: 69 / 255, blue: 96 / 255),
                accent: LBColor.gold
            )
        case 1:
            return LBCollectionPalette(
                start: Color(red: 40 / 255, green: 29 / 255, blue: 53 / 255),
                end: Color(red: 114 / 255, green: 84 / 255, blue: 107 / 255),
                accent: LBColor.gold
            )
        case 2:
            return LBCollectionPalette(
                start: Color(red: 16 / 255, green: 43 / 255, blue: 44 / 255),
                end: Color(red: 52 / 255, green: 119 / 255, blue: 116 / 255),
                accent: LBColor.gold
            )
        default:
            return LBCollectionPalette(
                start: Color(red: 11 / 255, green: 30 / 255, blue: 56 / 255),
                end: Color(red: 53 / 255, green: 109 / 255, blue: 148 / 255),
                accent: LBColor.gold
            )
        }
    }
}

struct LBCollectionCard: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let section: CatalogSection
    let index: Int
    var style: LBCollectionCardStyle = .full
    let action: () -> Void

    private var palette: LBCollectionPalette {
        style == .compact ? .homePalette(at: index) : .palette(at: index)
    }
    private var height: CGFloat { style == .compact ? 142 : LBLayout.collectionHeight }

    var body: some View {
        Button(action: action) { cardContent }
        .buttonStyle(LBPlainButtonStyle())
        .focusEffectDisabled()
        .accessibilityLabel("\(section.title), \(section.items.count) films")
        .accessibilityHint(style == .compact ? "Show collection" : "Show titles in this collection")
        .accessibilityIdentifier("collection-\(section.id)")
    }

    private var cardContent: some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [palette.start, palette.end], startPoint: .topLeading, endPoint: .bottomTrailing)
            ellipseDecoration
            accentDot
            cardCopy
            directoryNumber
        }
        .frame(height: height)
        .clipShape(cardShape)
        .overlay { focusBorder }
        .scaleEffect(isFocused ? 1.035 : 1)
        .shadow(
            color: isFocused ? palette.accent.opacity(0.24) : .black.opacity(0.3),
            radius: isFocused ? 24 : 16,
            y: 13
        )
        .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
    }

    private var ellipseDecoration: some View {
        Ellipse()
            .stroke(Color.white.opacity(0.13), lineWidth: 1)
            .frame(width: ellipseWidth, height: ellipseHeight)
            .overlay {
                Ellipse()
                    .stroke(Color.white.opacity(0.035), lineWidth: 26)
                    .frame(width: ellipseWidth, height: ellipseHeight)
            }
            .rotationEffect(.degrees(30))
            .offset(x: style == .compact ? 135 : 205, y: style == .compact ? -45 : -75)
    }

    private var accentDot: some View {
        Circle()
            .fill(palette.accent)
            .frame(width: 8, height: 8)
            .shadow(color: palette.accent, radius: 13)
            .offset(x: style == .compact ? 230 : 300, y: style == .compact ? -75 : -125)
    }

    private var cardCopy: some View {
        VStack(alignment: .leading, spacing: style == .compact ? 6 : 11) {
            Text(kicker)
                .font(LBTypography.eyebrow(size: 11))
                .tracking(style == .compact ? 1.7 : 2.1)
                .foregroundStyle(palette.accent)
            Text(section.title)
                .font(LBTypography.title(size: style == .compact ? 24 : 26, weight: .bold))
                .foregroundStyle(LBColor.text)
                .lineLimit(2)
            Text(summary)
                .font(LBTypography.caption(size: style == .compact ? 14 : 15, weight: .medium))
                .foregroundStyle(LBColor.textSecondary)
                .lineLimit(style == .compact ? 1 : 2)
            if style == .full {
                Text("\(section.items.count) catalogue records")
                    .font(LBTypography.caption(size: 13, weight: .medium))
                    .foregroundStyle(LBColor.textMuted)
            }
        }
        .padding(style == .compact ? 18 : 25)
    }

    private var directoryNumber: some View {
        Text(String(index + 1).leftPaddedCollection(to: 2))
            .font(LBTypography.display(size: style == .compact ? 52 : 60, weight: .heavy))
            .foregroundStyle(Color.white.opacity(0.16))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .padding(style == .compact ? 15 : 22)
    }

    private var cardShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: style == .compact ? LBRadius.medium : 15, style: .continuous)
    }

    private var focusBorder: some View {
        cardShape.stroke(
            isFocused ? LBColor.text : Color.white.opacity(0.09),
            lineWidth: isFocused ? 4 : 1
        )
    }

    private var ellipseWidth: CGFloat { style == .compact ? 245 : 330 }
    private var ellipseHeight: CGFloat { style == .compact ? 215 : 360 }
    private var kicker: String { style == .compact ? "LELIBRAMBAS+" : collectionKind.uppercased() }
    private var summary: String { style == .compact ? "\(section.items.count) films" : collectionDescription }

    private var collectionKind: String {
        section.title.caseInsensitiveCompare("VAKANTIEFILMS") == .orderedSame ? "holiday" : "curated"
    }

    private var collectionDescription: String {
        "\(section.items.count) films in \(section.title)."
    }
}

private extension String {
    func leftPaddedCollection(to length: Int) -> String {
        String(repeating: "0", count: max(0, length - count)) + self
    }
}
