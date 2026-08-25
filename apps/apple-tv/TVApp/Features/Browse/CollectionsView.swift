import LeliBrambasCore
import SwiftUI

struct CollectionsView: View {
    let sections: [CatalogSection]
    let onSelect: (CatalogSection) -> Void

    private let columns = [GridItem(.adaptive(minimum: 430, maximum: 620), spacing: 34)]

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text("Collections")
                    .font(.system(size: 56, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)
                LazyVGrid(columns: columns, alignment: .leading, spacing: 34) {
                    ForEach(sections) { section in
                        CollectionCard(section: section) { onSelect(section) }
                    }
                }
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .accessibilityIdentifier("collections-screen")
    }
}

private struct CollectionCard: View {
    @Environment(\.isFocused) private var isFocused
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let section: CatalogSection
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack(alignment: .bottomLeading) {
                if let item = section.items.first {
                    LBArtwork(item: item, kind: .backdrop)
                }
                LinearGradient(colors: [.clear, LBColor.canvas.opacity(0.95)], startPoint: .top, endPoint: .bottom)
                VStack(alignment: .leading, spacing: 8) {
                    Text(section.title)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                    Text("\(section.items.count) films")
                        .font(.system(size: 21, weight: .medium, design: .rounded))
                        .foregroundStyle(LBColor.textSecondary)
                }
                .padding(30)
            }
            .foregroundStyle(LBColor.text)
            .frame(height: 285)
            .clipShape(RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous)
                    .stroke(isFocused ? LBColor.text : LBColor.text.opacity(0.1), lineWidth: isFocused ? 4 : 1)
            }
            .scaleEffect(isFocused ? LBLayout.focusScale : 1)
            .shadow(color: isFocused ? LBColor.gold.opacity(0.34) : .black.opacity(0.3), radius: isFocused ? 25 : 12, y: 12)
            .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(section.title), \(section.items.count) films")
        .accessibilityHint("Open collection")
        .accessibilityIdentifier("collection-\(section.id)")
    }
}

struct CollectionDetailView: View {
    let section: CatalogSection
    let onSelect: (MediaItem) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text(section.title)
                    .font(.system(size: 58, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)
                Text("\(section.items.count) films from the archive")
                    .font(.system(size: 24, design: .rounded))
                    .foregroundStyle(LBColor.textSecondary)
                LBMediaGrid(items: section.items, onSelect: onSelect)
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .background(LBBackground())
        .accessibilityIdentifier("collection-detail-\(section.id)")
    }
}
