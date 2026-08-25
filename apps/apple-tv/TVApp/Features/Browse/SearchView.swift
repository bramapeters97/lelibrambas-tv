import LeliBrambasCore
import SwiftUI

struct SearchView: View {
    let items: [MediaItem]
    let onSelect: (MediaItem) -> Void

    @State private var query = ""

    private var results: [MediaItem] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return items }
        return items.filter {
            $0.title.localizedCaseInsensitiveContains(normalized)
                || $0.category.localizedCaseInsensitiveContains(normalized)
                || $0.description.localizedCaseInsensitiveContains(normalized)
        }
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                Text("Search")
                    .font(.system(size: 56, weight: .heavy, design: .rounded))
                    .foregroundStyle(LBColor.text)
                    .accessibilityAddTraits(.isHeader)

                HStack(spacing: 18) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(LBColor.textMuted)
                    TextField("Titles, collections and memories", text: $query)
                        .font(.system(size: 28, weight: .medium, design: .rounded))
                        .textFieldStyle(.plain)
                        .accessibilityIdentifier("search-field")
                    if !query.isEmpty {
                        Button {
                            query = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 28))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Clear search")
                    }
                }
                .padding(.horizontal, 28)
                .frame(height: 76)
                .background(LBColor.surfaceRaised, in: RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous))

                if results.isEmpty {
                    LBEmptyState(title: "No films found", message: "Try another title or collection name.")
                        .frame(height: 520)
                } else {
                    LBMediaGrid(items: results, onSelect: onSelect)
                }
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .accessibilityIdentifier("search-screen")
    }
}
