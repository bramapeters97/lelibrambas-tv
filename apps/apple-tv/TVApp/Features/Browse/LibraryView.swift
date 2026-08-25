import LeliBrambasCore
import SwiftUI

struct LibraryView: View {
    let items: [MediaItem]
    let onSelect: (MediaItem) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text("Library")
                    .font(.system(size: 56, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)
                Text("Every available film, ordered as in the web archive.")
                    .font(.system(size: 24, design: .rounded))
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

    private let columns = [GridItem(.adaptive(minimum: 238, maximum: 270), spacing: 32, alignment: .top)]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 46) {
            ForEach(items) { item in
                LBMediaCard(item: item, width: 238) { onSelect(item) }
            }
        }
        .padding(.vertical, 20)
    }
}
