import SwiftUI

struct SettingsView: View {
    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text("Settings")
                    .font(.system(size: 56, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)

                settingsCard
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
            .frame(maxWidth: 980, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityIdentifier("settings-screen")
    }

    private var settingsCard: some View {
        VStack(spacing: 0) {
            SettingsRow(icon: "apple.logo", title: "Application", value: "LeliBrambas+ for Apple TV")
            Divider().overlay(LBColor.text.opacity(0.1))
            SettingsRow(icon: "number", title: "Version", value: versionLabel)
            Divider().overlay(LBColor.text.opacity(0.1))
            SettingsRow(icon: "shippingbox.fill", title: "Content", value: "Bundled catalogue and artwork")
        }
        .background(LBColor.surface.opacity(0.9), in: RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous)
                .stroke(LBColor.text.opacity(0.08), lineWidth: 1)
        }
    }

    private var versionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "–"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "–"
        return "\(version) (\(build))"
    }
}

private struct SettingsRow: View {
    let icon: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: LBSpacing.medium) {
            Image(systemName: icon)
                .font(.system(size: 27, weight: .semibold))
                .foregroundStyle(LBColor.cyan)
                .frame(width: 42)
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 19, weight: .medium, design: .rounded))
                    .foregroundStyle(LBColor.textMuted)
                Text(value)
                    .font(.system(size: 25, weight: .semibold, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .lineLimit(2)
            }
            Spacer()
        }
        .padding(.horizontal, 30)
        .padding(.vertical, 25)
        .accessibilityElement(children: .combine)
    }
}
