import LeliBrambasCore
import SwiftUI

struct LibraryView: View {
    let items: [MediaItem]
    let focusScope: Namespace.ID
    let onSelect: (MediaItem) -> Void

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                pageHeader
                catalogueHeader
                LBMediaGrid(
                    items: items,
                    focusScope: focusScope,
                    prefersInitialFocus: true,
                    onSelect: onSelect
                )
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .accessibilityIdentifier("library-screen")
    }

    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("EVERY FILM IN THE PRIVATE ARCHIVE")
                .font(LBTypography.eyebrow(size: 16))
                .tracking(3.5)
                .foregroundStyle(LBColor.gold)
            Text("Full Library")
                .font(LBTypography.display(size: 54, weight: .heavy))
                .foregroundStyle(LBColor.text)
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var catalogueHeader: some View {
        HStack(alignment: .bottom, spacing: LBSpacing.medium) {
            VStack(alignment: .leading, spacing: 9) {
                Text("COMPLETE CATALOGUE")
                    .font(LBTypography.eyebrow(size: 14))
                    .tracking(3)
                    .foregroundStyle(LBColor.gold)
                LBSectionTitle(title: "All movies", icon: .movies)
            }
            Spacer()
            Text("\(items.count) titles")
                .font(LBTypography.caption(size: 18, weight: .medium))
                .foregroundStyle(LBColor.textMuted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Complete catalogue. All movies. \(items.count) titles.")
    }
}

struct LBMediaGrid: View {
    let items: [MediaItem]
    let focusScope: Namespace.ID
    var prefersInitialFocus = false
    var prefersFirstItemOnEntry = false
    let onSelect: (MediaItem) -> Void

    @FocusState private var focusedItemID: Int?

    private let columns = [
        GridItem(
            .adaptive(
                minimum: LBLayout.gridMediaCardWidth,
                maximum: LBLayout.gridMediaCardWidth
            ),
            spacing: LBSpacing.shelfGap,
            alignment: .top
        ),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 36) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                LBMediaCard(item: item, width: LBLayout.gridMediaCardWidth, index: index) {
                    onSelect(item)
                }
                .focused($focusedItemID, equals: item.id)
                .prefersDefaultFocus(prefersInitialFocus && item.id == items.first?.id, in: focusScope)
            }
        }
        .focusSection()
        .defaultFocus(
            $focusedItemID,
            prefersInitialFocus || prefersFirstItemOnEntry ? items.first?.id : nil,
            priority: prefersFirstItemOnEntry ? .userInitiated : .automatic
        )
        .task(id: items.first?.id) {
            guard prefersInitialFocus else { return }
            await Task.yield()
            focusedItemID = items.first?.id
        }
        .padding(.vertical, 20)
    }
}
