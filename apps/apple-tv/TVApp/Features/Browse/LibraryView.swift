import LeliBrambasCore
import SwiftUI

struct LibraryView: View {
    let items: [MediaItem]
    let onSelect: (MediaItem) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text("Library")
                    .font(LBTypography.display(size: 54, weight: .heavy))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)
                Text("Every available film, ordered as in the web archive.")
                    .font(LBTypography.body(size: 22))
                    .foregroundStyle(LBColor.textSecondary)
                LBMediaGrid(items: items, onSelect: onSelect)
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .accessibilityIdentifier("library-screen")
    }
}

struct LBMediaGrid: View {
    let items: [MediaItem]
    let onSelect: (MediaItem) -> Void

    private let columns = [
        GridItem(
            .adaptive(
                minimum: LBLayout.compactMediaCardWidth,
                maximum: LBLayout.mediaCardWidth
            ),
            spacing: LBSpacing.shelfGap,
            alignment: .top
        ),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 36) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                LBMediaCard(item: item, width: LBLayout.compactMediaCardWidth, index: index) {
                    onSelect(item)
                }
            }
        }
        .padding(.vertical, 20)
    }
}
