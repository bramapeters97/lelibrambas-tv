import LeliBrambasCore
import SwiftUI

struct CollectionsView: View {
    let sections: [CatalogSection]
    let onSelect: (CatalogSection) -> Void

    private let columns = Array(
        repeating: GridItem(.flexible(), spacing: LBLayout.collectionGap),
        count: 4
    )

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text("Collections")
                    .font(LBTypography.display(size: 54, weight: .heavy))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)
                LazyVGrid(columns: columns, alignment: .leading, spacing: LBLayout.collectionGap) {
                    ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
                        LBCollectionCard(section: section, index: index) { onSelect(section) }
                    }
                }
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .accessibilityIdentifier("collections-screen")
    }
}

struct CollectionDetailView: View {
    let section: CatalogSection
    let onSelect: (MediaItem) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text(section.title)
                    .font(LBTypography.display(size: 54, weight: .heavy))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)
                Text("\(section.items.count) films from the archive")
                    .font(LBTypography.body(size: 22))
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
