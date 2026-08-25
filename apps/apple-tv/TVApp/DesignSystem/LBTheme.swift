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
    static let rose = Color(red: 197 / 255, green: 109 / 255, blue: 114 / 255)

    static let background = LinearGradient(
        colors: [canvasRaised, canvas],
        startPoint: .top,
        endPoint: .bottom
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
    static let safeHorizontal: CGFloat = 80
    static let safeVertical: CGFloat = 54
    static let shelfGap: CGFloat = 28
}

enum LBRadius {
    static let small: CGFloat = 10
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
}

enum LBLayout {
    static let navigationWidth: CGFloat = 132
    static let contentMaxWidth: CGFloat = 1700
    static let posterWidth: CGFloat = 250
    static let posterAspectRatio: CGFloat = 2 / 3
    static let backdropAspectRatio: CGFloat = 16 / 9
    static let focusScale: CGFloat = 1.055
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
                colors: [LBColor.indigo.opacity(0.13), .clear],
                center: UnitPoint(x: 0.72, y: 0.12),
                startRadius: 20,
                endRadius: 820
            )
            RadialGradient(
                colors: [LBColor.cyan.opacity(0.08), .clear],
                center: UnitPoint(x: 0.2, y: 0.68),
                startRadius: 20,
                endRadius: 680
            )
        }
        .ignoresSafeArea()
    }
}

struct LBWordmark: View {
    var compact = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: compact ? 2 : 5) {
            Text("LELIBRAMBAS")
                .font(.system(size: compact ? 24 : 58, weight: .heavy, design: .rounded))
                .tracking(-1.4)
            Text("+")
                .font(.system(size: compact ? 26 : 62, weight: .black, design: .rounded))
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
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.23, style: .continuous)
                .fill(LBColor.aurora)
            Image(systemName: "movieclapper.fill")
                .font(.system(size: size * 0.46, weight: .black))
                .foregroundStyle(LBColor.canvas)
        }
        .frame(width: size, height: size)
        .shadow(color: LBColor.cyan.opacity(0.34), radius: size * 0.22)
        .accessibilityHidden(true)
    }
}

struct LBSectionTitle: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .foregroundStyle(LBColor.text)
            .lineLimit(1)
            .accessibilityAddTraits(.isHeader)
    }
}
