import SwiftUI

struct ProfileSelectionView: View {
    let profiles: [ViewerProfile]
    let onSelect: (ViewerProfile) -> Void

    @FocusState private var focusedProfileID: String?

    var body: some View {
        ZStack {
            profileBackground
            ProfileDotField()
                .opacity(0.2)
                .mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom))

            VStack(spacing: 0) {
                LBWordmark(size: 77)

                VStack(spacing: 14) {
                    Text("WELCOME TO THE FAMILY ARCHIVE")
                        .font(LBTypography.eyebrow(size: 18))
                        .tracking(5.4)
                        .foregroundStyle(LBColor.gold)
                    Text("Who’s watching?")
                        .font(LBTypography.display(size: 50, weight: .medium))
                        .foregroundStyle(LBColor.text)
                }
                .padding(.top, 52)
                .padding(.bottom, 58)

                HStack(alignment: .top, spacing: 48) {
                    ForEach(profiles) { profile in
                        ProfileButton(profile: profile) {
                            onSelect(profile)
                        }
                        .focused($focusedProfileID, equals: profile.id)
                    }
                }

                Text("A PRIVATE LELIBRAMBAS+ LOCAL MEDIA LIBRARY")
                    .font(LBTypography.caption(size: 15, weight: .medium))
                    .tracking(2.5)
                    .foregroundStyle(LBColor.textMuted)
                    .padding(.top, 52)
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, 46)
        }
        .onAppear { focusedProfileID = profiles.first?.id }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("profile-selector")
    }

    private var profileBackground: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 8 / 255, green: 16 / 255, blue: 32 / 255), LBColor.canvas, Color(red: 7 / 255, green: 9 / 255, blue: 22 / 255)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [LBColor.cyan.opacity(0.09), .clear],
                center: UnitPoint(x: 0.14, y: 0.1),
                startRadius: 8,
                endRadius: 560
            )
            RadialGradient(
                colors: [LBColor.indigo.opacity(0.1), .clear],
                center: UnitPoint(x: 0.86, y: 0.8),
                startRadius: 8,
                endRadius: 620
            )
        }
        .ignoresSafeArea()
    }
}

private struct ProfileButton: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let profile: ViewerProfile
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                ProfileAvatar(profile: profile, focused: isFocused)
                Text(profile.name)
                    .font(LBTypography.title(size: 27, weight: .semibold))
                    .foregroundStyle(LBColor.text)
                    .padding(.top, 24)
                Text("Ready to watch")
                    .font(LBTypography.caption(size: 16, weight: .regular))
                    .tracking(1)
                    .foregroundStyle(LBColor.textMuted)
                    .padding(.top, 7)
            }
            .frame(width: 270)
            .scaleEffect(isFocused ? 1.04 : 1)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(LBPlainButtonStyle())
        .focusEffectDisabled()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(profile.name)
        .accessibilityHint("Open this local profile")
        .accessibilityAddTraits(.isButton)
        .accessibilityIdentifier("profile-\(profile.id)")
    }
}

private struct ProfileAvatar: View {
    let profile: ViewerProfile
    let focused: Bool

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [profile.accent.opacity(0.86), LBColor.surface],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color.white.opacity(0.54), profile.accent.opacity(0.2), .clear],
                center: UnitPoint(x: 0.3, y: 0.22),
                startRadius: 4,
                endRadius: 115
            )
            Circle()
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
                .frame(width: 174, height: 174)
                .overlay(Circle().stroke(Color.white.opacity(0.05), lineWidth: 28))
            Text(profile.initials)
                .font(LBTypography.display(size: 66, weight: .bold))
                .foregroundStyle(Color.white)
            Circle()
                .fill(profile.accent)
                .frame(width: 12, height: 12)
                .shadow(color: profile.accent.opacity(0.7), radius: 12)
                .offset(x: 82, y: 82)
        }
        .frame(width: 220, height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 62, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 62, style: .continuous)
                .stroke(Color.white.opacity(focused ? 1 : 0.16), lineWidth: focused ? 4 : 1)
                .padding(focused ? -8 : 0)
        }
        .shadow(color: focused ? profile.accent.opacity(0.25) : .black.opacity(0.34), radius: focused ? 30 : 24, y: 18)
    }
}

private struct ProfileDotField: View {
    var body: some View {
        Canvas { context, size in
            for x in stride(from: CGFloat(18), through: size.width, by: 42) {
                for y in stride(from: CGFloat(18), through: size.height, by: 42) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(.white.opacity(0.23)))
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
