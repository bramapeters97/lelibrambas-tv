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
}

struct LBCollectionCard: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let section: CatalogSection
    let index: Int
    var style: LBCollectionCardStyle = .full
    let action: () -> Void

    private var palette: LBCollectionPalette { .palette(at: index) }
    private var height: CGFloat { style == .compact ? 142 : LBLayout.collectionHeight }

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .bottomLeading) {
                LinearGradient(colors: [palette.start, palette.end], startPoint: .topLeading, endPoint: .bottomTrailing)
                Ellipse()
                    .stroke(Color.white.opacity(0.13), lineWidth: 1)
                    .frame(width: style == .compact ? 245 : 330, height: style == .compact ? 215 : 360)
                    .rotationEffect(.degrees(30))
                    .offset(x: style == .compact ? 135 : 205, y: style == .compact ? -45 : -75)
                    .overlay {
                        Ellipse()
                            .stroke(Color.white.opacity(0.035), lineWidth: 26)
                            .frame(width: style == .compact ? 245 : 330, height: style == .compact ? 215 : 360)
                            .rotationEffect(.degrees(30))
                            .offset(x: style == .compact ? 135 : 205, y: style == .compact ? -45 : -75)
                    }
                Circle()
                    .fill(palette.accent)
                    .frame(width: 8, height: 8)
                    .shadow(color: palette.accent, radius: 13)
                    .offset(x: style == .compact ? 230 : 300, y: style == .compact ? -75 : -125)

                VStack(alignment: .leading, spacing: style == .compact ? 6 : 11) {
                    Text("LELIBRAMBAS+ COLLECTION")
                        .font(LBTypography.eyebrow(size: 11))
                        .tracking(style == .compact ? 1.7 : 2.1)
                        .foregroundStyle(palette.accent)
                    Text(section.title)
                        .font(LBTypography.title(size: style == .compact ? 24 : 26, weight: .bold))
                        .foregroundStyle(LBColor.text)
                        .lineLimit(2)
                    Text("\(section.items.count) films")
                        .font(LBTypography.caption(size: style == .compact ? 14 : 15, weight: .medium))
                        .foregroundStyle(LBColor.textSecondary)
                }
                .padding(style == .compact ? 18 : 25)

                Text(String(index + 1).leftPaddedCollection(to: 2))
                    .font(LBTypography.display(size: style == .compact ? 52 : 60, weight: .heavy))
                    .foregroundStyle(Color.white.opacity(0.16))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(style == .compact ? 15 : 22)
            }
            .frame(height: height)
            .clipShape(RoundedRectangle(cornerRadius: style == .compact ? LBRadius.medium : 15, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: style == .compact ? LBRadius.medium : 15, style: .continuous)
                    .stroke(isFocused ? LBColor.text : Color.white.opacity(0.09), lineWidth: isFocused ? 4 : 1)
            }
            .scaleEffect(isFocused ? 1.035 : 1)
            .shadow(color: isFocused ? palette.accent.opacity(0.24) : .black.opacity(0.3), radius: isFocused ? 24 : 16, y: 13)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(.plain)
        .focusEffectDisabled()
        .accessibilityLabel("\(section.title), \(section.items.count) films")
        .accessibilityHint("Open collection")
        .accessibilityIdentifier("collection-\(section.id)")
    }
}

private extension String {
    func leftPaddedCollection(to length: Int) -> String {
        String(repeating: "0", count: max(0, length - count)) + self
    }
}
