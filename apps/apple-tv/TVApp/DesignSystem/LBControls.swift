import SwiftUI

struct LBPlainButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.84 : 1)
    }
}

private struct LBButtonChrome: ViewModifier {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let primary: Bool
    let pressed: Bool

    func body(content: Content) -> some View {
        content
            .font(LBTypography.title(size: 22, weight: .bold))
            .foregroundStyle(primary ? LBColor.canvas : LBColor.text)
            .padding(.horizontal, 27)
            .frame(minHeight: 58)
            .background {
                RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
                    .fill(primary ? AnyShapeStyle(LBColor.text) : AnyShapeStyle(LBColor.surfaceRaised.opacity(0.94)))
                    .overlay {
                        RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
                            .stroke(isFocused ? LBColor.text : LBColor.text.opacity(primary ? 0 : 0.16), lineWidth: isFocused ? 3 : 1)
                    }
            }
            .scaleEffect(pressed ? 0.985 : (isFocused ? LBLayout.focusScale : 1))
            .shadow(color: isFocused ? LBColor.gold.opacity(0.32) : .black.opacity(0.26), radius: isFocused ? 23 : 12, y: 12)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
            .animation(reduceMotion ? nil : LBMotion.standard, value: pressed)
    }
}

struct LBPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.modifier(LBButtonChrome(primary: true, pressed: configuration.isPressed))
    }
}

struct LBSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.modifier(LBButtonChrome(primary: false, pressed: configuration.isPressed))
    }
}

struct LBPrimaryButton<Label: View>: View {
    let action: () -> Void
    let label: Label

    init(action: @escaping () -> Void, @ViewBuilder label: () -> Label) {
        self.action = action
        self.label = label()
    }

    var body: some View {
        Button(action: action) { label }
            .buttonStyle(LBPrimaryButtonStyle())
    }
}

struct LBSecondaryButton<Label: View>: View {
    let action: () -> Void
    let label: Label

    init(action: @escaping () -> Void, @ViewBuilder label: () -> Label) {
        self.action = action
        self.label = label()
    }

    var body: some View {
        Button(action: action) { label }
            .buttonStyle(LBSecondaryButtonStyle())
    }
}

struct LBMetadataRow: View {
    let values: [String]

    var body: some View {
        HStack(spacing: 12) {
            ForEach(Array(values.enumerated()), id: \.offset) { index, value in
                if index > 0 {
                    Circle()
                        .fill(LBColor.textMuted)
                        .frame(width: 6, height: 6)
                        .accessibilityHidden(true)
                }
                Text(value)
                    .lineLimit(1)
            }
        }
        .font(LBTypography.caption(size: 20, weight: .semibold))
        .foregroundStyle(LBColor.textSecondary)
        .accessibilityElement(children: .combine)
    }
}

struct LBLoadingView: View {
    let message: String

    var body: some View {
        VStack(spacing: LBSpacing.large) {
            LBWordmark()
            ProgressView()
                .progressViewStyle(.circular)
                .tint(LBColor.cyan)
                .scaleEffect(1.6)
            Text(message)
                .font(LBTypography.body(size: 25, weight: .medium))
                .foregroundStyle(LBColor.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("loading-view")
    }
}

struct LBErrorView: View {
    let error: AppError
    let retry: () -> Void

    var body: some View {
        VStack(spacing: LBSpacing.medium) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 54, weight: .semibold))
                .foregroundStyle(LBColor.gold)
            Text(error.title)
                .font(LBTypography.display(size: 42, weight: .bold))
                .foregroundStyle(LBColor.text)
            Text(error.message)
                .font(LBTypography.body(size: 25))
                .foregroundStyle(LBColor.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 760)
            LBPrimaryButton(action: retry) {
                Label("Try again", systemImage: "arrow.clockwise")
            }
            .accessibilityIdentifier("error-retry")
        }
        .padding(70)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("error-view")
    }
}

struct LBEmptyState: View {
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: LBSpacing.medium) {
            Image(systemName: "film.stack")
                .font(.system(size: 64, weight: .light))
                .foregroundStyle(LBColor.cyan)
            Text(title)
                .font(LBTypography.display(size: 42, weight: .bold))
                .foregroundStyle(LBColor.text)
            Text(message)
                .font(LBTypography.body(size: 25))
                .foregroundStyle(LBColor.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("empty-state")
    }
}

struct LaunchView: View {
    let message: String

    var body: some View {
        ZStack {
            LBBackground()
            VStack(spacing: LBSpacing.large) {
                LBLogo(size: 86)
                LBWordmark()
                ProgressView()
                    .tint(LBColor.cyan)
                Text(message)
                    .foregroundStyle(LBColor.textSecondary)
            }
        }
        .accessibilityIdentifier("launch-view")
    }
}
