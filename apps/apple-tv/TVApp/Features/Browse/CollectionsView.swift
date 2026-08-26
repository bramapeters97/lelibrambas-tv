import LeliBrambasCore
import SwiftUI

struct CollectionsView: View {
    let sections: [CatalogSection]
    let initialSelectionID: String?
    let onSelect: (MediaItem) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedID: String?
    @FocusState private var focusedCollectionID: String?

    private let columns = Array(
        repeating: GridItem(.flexible(), spacing: LBLayout.collectionGap),
        count: 4
    )

    init(
        sections: [CatalogSection],
        initialSelectionID: String? = nil,
        onSelect: @escaping (MediaItem) -> Void
    ) {
        self.sections = sections
        self.initialSelectionID = initialSelectionID
        self.onSelect = onSelect
        if let initialSelectionID, sections.contains(where: { $0.id == initialSelectionID }) {
            _selectedID = State(initialValue: initialSelectionID)
        } else {
            _selectedID = State(initialValue: sections.first?.id)
        }
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Collections")
                        .font(LBTypography.display(size: 54, weight: .heavy))
                        .foregroundStyle(LBColor.text)
                        .accessibilityAddTraits(.isHeader)
                    Text("Private directory overview")
                        .font(LBTypography.eyebrow(size: 15))
                        .tracking(2.6)
                        .foregroundStyle(LBColor.gold)
                        .textCase(.uppercase)
                }

                if sections.isEmpty {
                    LBEmptyState(
                        title: "No collections",
                        message: "The bundled archive does not currently contain collection groups."
                    )
                    .frame(height: 520)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: LBLayout.collectionGap) {
                        ForEach(Array(sections.enumerated()), id: \.element.id) { index, section in
                            let isSelected = section.id == selectedID
                            LBCollectionCard(section: section, index: index) {
                                selectedID = section.id
                            }
                            .overlay {
                                RoundedRectangle(cornerRadius: 15, style: .continuous)
                                    .stroke(isSelected ? LBColor.text : .clear, lineWidth: 4)
                            }
                            .scaleEffect(isSelected ? 1.025 : 1)
                            .animation(reduceMotion ? nil : LBMotion.standard, value: isSelected)
                            .focused($focusedCollectionID, equals: section.id)
                            .accessibilityAddTraits(isSelected ? .isSelected : [])
                        }
                    }
                    .focusSection()

                    selectedCollection
                }
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .onAppear { focusedCollectionID = selectedID }
        .onChange(of: focusedCollectionID) { _, focusedID in
            guard let focusedID, focusedID != selectedID else { return }
            selectedID = focusedID
        }
        .onChange(of: initialSelectionID) { _, requestedID in
            guard let requestedID, sections.contains(where: { $0.id == requestedID }) else { return }
            selectedID = requestedID
            focusedCollectionID = requestedID
        }
        .accessibilityIdentifier("collections-screen")
    }

    @ViewBuilder
    private var selectedCollection: some View {
        if let section = sections.first(where: { $0.id == selectedID }) {
            VStack(alignment: .leading, spacing: LBSpacing.medium) {
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 9) {
                        Text("\(collectionKind(for: section)) collection")
                            .font(LBTypography.eyebrow(size: 14))
                            .tracking(2.1)
                            .foregroundStyle(LBColor.gold)
                            .textCase(.uppercase)
                        LBSectionTitle(
                            title: section.title,
                            countText: "\(section.items.count) titles"
                        )
                    }
                    Spacer()
                    Text("Directory order")
                        .font(LBTypography.caption(size: 15, weight: .medium))
                        .foregroundStyle(LBColor.textMuted)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)

                LBMediaGrid(items: section.items, onSelect: onSelect)
            }
            .id(section.id)
            .transition(.asymmetric(
                insertion: .opacity.combined(with: .offset(y: 14)),
                removal: .opacity
            ))
            .animation(reduceMotion ? nil : .easeOut(duration: 0.65), value: selectedID)
            .accessibilityIdentifier("collection-results-\(section.id)")
        }
    }

    private func collectionKind(for section: CatalogSection) -> String {
        section.title.caseInsensitiveCompare("VAKANTIEFILMS") == .orderedSame ? "holiday" : "curated"
    }
}
