import LeliBrambasCore
import SwiftUI
import UIKit

enum LBSearchIndex {
    static let suggestionLimit = 8

    static func results(in items: [MediaItem], query: String) -> [MediaItem] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return Array(items.prefix(suggestionLimit)) }

        return items.filter { item in
            [
                item.title,
                item.category,
                item.description,
                item.year.map(String.init),
            ]
            .compactMap { $0 }
            .contains { $0.localizedCaseInsensitiveContains(normalized) }
        }
    }
}

struct SearchView: View {
    let items: [MediaItem]
    let onSelect: (MediaItem) -> Void

    @State private var query = ""
    @FocusState private var searchFieldFocused: Bool

    private var results: [MediaItem] {
        LBSearchIndex.results(in: items, query: query)
    }

    private var normalizedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: LBSpacing.large) {
                pageHeader
                searchPanel
                resultsHeader

                if results.isEmpty {
                    LBEmptyState(title: "No movie found.", message: "Try a category, year or another title.")
                        .frame(height: 520)
                } else {
                    LBMediaGrid(items: results, onSelect: onSelect)
                }
            }
            .padding(.horizontal, LBSpacing.safeHorizontal)
            .padding(.vertical, LBSpacing.safeVertical)
        }
        .defaultFocus($searchFieldFocused, true)
        .task {
            await Task.yield()
            searchFieldFocused = true
        }
        .accessibilityIdentifier("search-screen")
    }

    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TITLES, FOLDER GROUPS, YEARS AND COLLECTIONS")
                .font(LBTypography.eyebrow(size: 16))
                .tracking(3.5)
                .foregroundStyle(LBColor.gold)
            Text("Search the archive")
                .font(LBTypography.display(size: 54, weight: .heavy))
                .foregroundStyle(LBColor.text)
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text("Which folder should we open?")
                .font(LBTypography.caption(size: 18, weight: .medium))
                .foregroundStyle(LBColor.textSecondary)

            HStack(spacing: 18) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(LBColor.cyan)
                    .accessibilityHidden(true)
                TextField("Try a title, year or category", text: $query)
                    .font(LBTypography.body(size: 26, weight: .medium))
                    .textFieldStyle(.plain)
                    .focused($searchFieldFocused)
                    .accessibilityLabel("Search the archive")
                    .accessibilityIdentifier("search-field")
                if !query.isEmpty {
                    ClearSearchButton(action: clearSearch)
                }
            }
            .padding(.horizontal, 28)
            .frame(height: 76)
            .background(LBColor.canvas.opacity(0.65), in: RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous)
                    .stroke(LBColor.text.opacity(0.14), lineWidth: 1)
            }
        }
        .padding(28)
        .background(LBColor.surface.opacity(0.56), in: RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous)
                .stroke(LBColor.text.opacity(0.09), lineWidth: 1)
        }
        .focusSection()
    }

    private var resultsHeader: some View {
        HStack(alignment: .bottom, spacing: LBSpacing.medium) {
            VStack(alignment: .leading, spacing: 9) {
                Text(normalizedQuery.isEmpty ? "SUGGESTED FOR YOU" : "MATCHES")
                    .font(LBTypography.eyebrow(size: 14))
                    .tracking(3)
                    .foregroundStyle(LBColor.gold)
                Text(normalizedQuery.isEmpty ? "Start with a familiar shelf" : "\"\(query)\"")
                    .font(LBTypography.title(size: 34, weight: .bold))
                    .foregroundStyle(LBColor.text)
                    .lineLimit(1)
            }
            Spacer()
            Text("\(results.count) results")
                .font(LBTypography.caption(size: 18, weight: .medium))
                .foregroundStyle(LBColor.textMuted)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(resultAnnouncement)
    }

    private var resultAnnouncement: String {
        if normalizedQuery.isEmpty {
            return "Suggested for you. \(results.count) results."
        }
        return "Matches for \(query). \(results.count) results."
    }

    private func clearSearch() {
        query = ""
        searchFieldFocused = true
        UIAccessibility.post(
            notification: .announcement,
            argument: "Search cleared. Showing \(min(items.count, LBSearchIndex.suggestionLimit)) suggested titles."
        )
    }
}

private struct ClearSearchButton: View {
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(isFocused ? LBColor.canvas : LBColor.textSecondary)
                .frame(width: 42, height: 42)
                .background(isFocused ? LBColor.cyan : LBColor.text.opacity(0.08), in: Circle())
                .overlay {
                    Circle()
                        .stroke(isFocused ? LBColor.text.opacity(0.72) : LBColor.text.opacity(0.12), lineWidth: 1)
                }
                .scaleEffect(isFocused ? 1.06 : 1)
                .animation(reduceMotion ? nil : LBMotion.standard, value: isFocused)
        }
        .buttonStyle(LBPlainButtonStyle())
        .focusEffectDisabled()
        .accessibilityLabel("Clear search")
        .accessibilityHint("Show suggested titles")
        .accessibilityIdentifier("search-clear")
    }
}
