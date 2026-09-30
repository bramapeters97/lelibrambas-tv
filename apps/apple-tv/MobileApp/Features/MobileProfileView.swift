import SwiftUI

struct MobileProfileView: View {
    @EnvironmentObject private var model: AppModel
    @EnvironmentObject private var progress: PlaybackProgressStore
    @Environment(\.dynamicTypeSize) private var typeSize
    let selected: ViewerProfile?
    let onSelect: (ViewerProfile) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text("LELIBRAMBAS+").font(.title.bold()).foregroundStyle(LBColor.gold)
                    .accessibilityLabel("LeliBrambas plus")
                Text(selected == nil ? "Who’s watching?" : "Switch profile")
                    .font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: typeSize.isAccessibilitySize ? 280 : 140),
                                            spacing: 20)], spacing: 24) {
                    ForEach(ViewerProfile.all) { profile in
                        Button { onSelect(profile) } label: {
                            VStack(spacing: 12) {
                                Text(profile.initials).font(.largeTitle.bold())
                                    .frame(width: 88, height: 88)
                                    .foregroundStyle(profile.accent)
                                    .background(profile.accent.opacity(0.15),
                                                in: RoundedRectangle(cornerRadius: 24))
                                Text(profile.name).font(.headline).foregroundStyle(.white)
                                if selected?.id == profile.id {
                                    Label("Watching now", systemImage: "checkmark")
                                        .font(.caption).foregroundStyle(LBColor.gold)
                                }
                            }
                            .frame(maxWidth: .infinity, minHeight: 144, alignment: .top)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(MobilePressedStyle())
                        .accessibilityLabel(profile.name)
                        .accessibilityValue(selected?.id == profile.id ? "Current profile" : "")
                        .accessibilityIdentifier("profile-\(profile.id)")
                    }
                }
                if let selected {
                    let recent = progress.recentlyWatched(profileID: selected.id, items: model.items)
                    if !recent.isEmpty {
                        Text("Recently Watched").font(.title3.bold()).accessibilityAddTraits(.isHeader)
                        MobileMovieGrid(items: recent)
                    }
                    Text("Your viewing progress is saved on this iPhone for each profile.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .padding(20)
        }
        .background(Color.black)
        .navigationTitle(selected == nil ? "" : "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("profile-screen")
    }
}
