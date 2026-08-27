import SwiftUI

enum LBColor {
    static let canvas = Color(red: 3 / 255, green: 5 / 255, blue: 11 / 255)
    static let canvasRaised = Color(red: 7 / 255, green: 11 / 255, blue: 20 / 255)
    static let surface = Color(red: 17 / 255, green: 28 / 255, blue: 51 / 255)
    static let surfaceRaised = Color(red: 23 / 255, green: 37 / 255, blue: 65 / 255)
    static let text = Color(red: 247 / 255, green: 249 / 255, blue: 254 / 255)
    static let textSecondary = Color(red: 194 / 255, green: 203 / 255, blue: 220 / 255)
    static let textMuted = Color(red: 135 / 255, green: 147 / 255, blue: 169 / 255)
    static let cyan = Color(red: 112 / 255, green: 216 / 255, blue: 255 / 255)
    static let indigo = Color(red: 130 / 255, green: 117 / 255, blue: 255 / 255)
    static let gold = Color(red: 233 / 255, green: 199 / 255, blue: 120 / 255)
    static let navigationGold = Color(red: 1, green: 228 / 255, blue: 168 / 255)
    static let rose = Color(red: 197 / 255, green: 109 / 255, blue: 114 / 255)

    static let background = LinearGradient(
        stops: [
            .init(color: canvasRaised, location: 0),
            .init(color: Color(red: 4 / 255, green: 7 / 255, blue: 13 / 255), location: 0.38),
            .init(color: canvas, location: 0.78),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let aurora = LinearGradient(
        colors: [cyan, indigo],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let heroScrim = LinearGradient(
        stops: [
            .init(color: canvas.opacity(0.05), location: 0),
            .init(color: canvas.opacity(0.35), location: 0.48),
            .init(color: canvas.opacity(0.96), location: 1),
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    static let heroSideScrim = LinearGradient(
        stops: [
            .init(color: canvas.opacity(0.94), location: 0),
            .init(color: canvas.opacity(0.62), location: 0.42),
            .init(color: canvas.opacity(0.02), location: 1),
        ],
        startPoint: .leading,
        endPoint: .trailing
    )
}

enum LBSpacing {
    static let xSmall: CGFloat = 8
    static let small: CGFloat = 14
    static let medium: CGFloat = 24
    static let large: CGFloat = 38
    static let xLarge: CGFloat = 64
    static let safeHorizontal: CGFloat = 72
    static let safeVertical: CGFloat = 54
    static let shelfGap: CGFloat = 15
}

enum LBRadius {
    static let small: CGFloat = 10
    static let medium: CGFloat = 13
    static let large: CGFloat = 24
}

enum LBLayout {
    static let navigationWidth: CGFloat = 78
    static let contentMaxWidth: CGFloat = 1700
    static let mediaCardWidth: CGFloat = 250
    static let gridMediaCardWidth: CGFloat = 300
    static let cardAspectRatio: CGFloat = 16 / 9
    static let backdropAspectRatio: CGFloat = 16 / 9
    static let focusScale: CGFloat = 1.045
    static let collectionGap: CGFloat = 32
    static let collectionHeight: CGFloat = 188
}

enum LBTypography {
    static func display(size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    static func title(size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    static func body(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    static func caption(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    static func eyebrow(size: CGFloat) -> Font {
        .system(size: size, weight: .bold, design: .default)
    }
}

enum LBMotion {
    static let standardDuration = 0.24
    static let relaxedDuration = 0.42
    static let standard = Animation.easeOut(duration: standardDuration)
    static let relaxed = Animation.easeInOut(duration: relaxedDuration)
}

struct LBBackground: View {
    var body: some View {
        ZStack {
            LBColor.background
            RadialGradient(
                colors: [Color(red: 32 / 255, green: 48 / 255, blue: 78 / 255).opacity(0.09), .clear],
                center: UnitPoint(x: 0.82, y: 0),
                startRadius: 20,
                endRadius: 820
            )
        }
        .ignoresSafeArea()
    }
}

struct LBWordmark: View {
    var compact = false
    var size: CGFloat?

    init(compact: Bool = false, size: CGFloat? = nil) {
        self.compact = compact
        self.size = size
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: compact ? 2 : 5) {
            Text("LELIBRAMBAS")
                .font(LBTypography.display(size: size ?? (compact ? 24 : 58), weight: .heavy))
            Text("+")
                .font(LBTypography.display(size: size ?? (compact ? 26 : 62), weight: .black))
                .foregroundStyle(LBColor.cyan)
                .shadow(color: LBColor.cyan.opacity(0.7), radius: compact ? 5 : 14)
        }
        .foregroundStyle(LBColor.text)
        .lineLimit(1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("LeliBrambas plus")
    }
}

struct LBLogo: View {
    var size: CGFloat = 58

    var body: some View {
        Image("WebNavigationMark")
            .resizable()
            .renderingMode(.template)
            .scaledToFit()
            .foregroundStyle(LBColor.navigationGold)
            .padding(size * 0.205)
        .frame(width: size, height: size)
        .background(LBColor.surfaceRaised.opacity(0.001), in: RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
        .shadow(color: LBColor.gold.opacity(0.38), radius: size * 0.2)
        .accessibilityHidden(true)
    }
}

enum LBSectionIconName {
    case collections
    case trending
    case jeugdfilms
    case vakantiefilms
    case events
    case others
    case movies

    static func forLabel(_ label: String) -> LBSectionIconName {
        switch label.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() {
        case "COLLECTIONS": return .collections
        case "CURRENTLY TRENDING": return .trending
        case "JEUGDFILMS": return .jeugdfilms
        case "VAKANTIEFILMS": return .vakantiefilms
        case "EVENTS": return .events
        case "OTHERS": return .others
        default: return .movies
        }
    }

    var assetName: String {
        switch self {
        case .collections: return "WebSectionCollections"
        case .trending: return "WebSectionTrending"
        case .jeugdfilms: return "WebSectionJeugdfilms"
        case .vakantiefilms: return "WebSectionVakantiefilms"
        case .events: return "WebSectionEvents"
        case .others: return "WebSectionOthers"
        case .movies: return "WebSectionMovies"
        }
    }
}

struct LBSectionTitle: View {
    let title: String
    let icon: LBSectionIconName
    var countText: String?

    init(title: String, icon: LBSectionIconName? = nil, countText: String? = nil) {
        self.title = title
        self.icon = icon ?? .forLabel(title)
        self.countText = countText
    }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(icon.assetName)
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 23, height: 23)
                .foregroundStyle(LBColor.text.opacity(0.92))
                .accessibilityHidden(true)
            Text(title)
                .font(LBTypography.title(size: 31, weight: .bold))
                .foregroundStyle(LBColor.text)
                .lineLimit(1)
                .accessibilityAddTraits(.isHeader)
            if let countText {
                Text(countText)
                    .font(LBTypography.caption(size: 16, weight: .medium))
                    .foregroundStyle(LBColor.textMuted)
                    .lineLimit(1)
                    .padding(.leading, 8)
            }
        }
    }
}
