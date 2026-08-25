import LeliBrambasCore
import SwiftUI
import UIKit

enum LBArtworkKind {
    case poster
    case backdrop
}

enum BundledArtworkResolver {
    static let fallbackPath = "artwork/generic_cinema_2.png"

    static func url(for source: String, bundle: Bundle = .main) -> URL? {
        if source.hasPrefix("fixture://") { return nil }
        return resourceURL(for: source, bundle: bundle)
            ?? resourceURL(for: fallbackPath, bundle: bundle)
    }

    private static func resourceURL(for source: String, bundle: Bundle) -> URL? {
        let normalized = source.replacingOccurrences(of: "\\", with: "/")
        guard !normalized.isEmpty,
              !normalized.hasPrefix("/"),
              !normalized.contains("../"),
              URL(string: normalized)?.scheme == nil else {
            return nil
        }

        let relative = normalized.hasPrefix("artwork/")
            ? String(normalized.dropFirst("artwork/".count))
            : normalized
        let component = relative as NSString
        let fileName = component.deletingPathExtension
        let fileExtension = component.pathExtension
        guard !fileName.isEmpty, !fileExtension.isEmpty else { return nil }
        return bundle.url(forResource: fileName, withExtension: fileExtension, subdirectory: "artwork")
    }
}

struct LBArtwork: View {
    let item: MediaItem
    let kind: LBArtworkKind

    private var source: String {
        switch kind {
        case .poster:
            return item.posterURL
        case .backdrop:
            return item.backdropURL ?? item.posterURL
        }
    }

    var body: some View {
        Group {
            if let image = bundledImage {
                Image(uiImage: image)
                    .resizable()
            } else {
                placeholder
            }
        }
        .aspectRatio(kind == .poster ? LBLayout.posterAspectRatio : LBLayout.backdropAspectRatio, contentMode: .fill)
        .clipped()
        .accessibilityHidden(true)
    }

    private var bundledImage: UIImage? {
        guard let url = BundledArtworkResolver.url(for: source) else { return nil }
        return UIImage(contentsOfFile: url.path)
    }

    private var placeholder: some View {
        let palette = LBArtwork.palette(for: item.id)
        return ZStack {
            LinearGradient(colors: palette, startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(
                colors: [LBColor.cyan.opacity(0.3), .clear],
                center: .topTrailing,
                startRadius: 10,
                endRadius: kind == .poster ? 280 : 800
            )
            VStack(spacing: 12) {
                Image(systemName: "play.rectangle.fill")
                    .font(.system(size: kind == .poster ? 42 : 74, weight: .semibold))
                Text(item.title)
                    .font(.system(size: kind == .poster ? 20 : 34, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal)
            }
            .foregroundStyle(LBColor.text.opacity(0.88))
        }
    }

    private static func palette(for id: Int) -> [Color] {
        switch abs(id) % 5 {
        case 0: return [Color(red: 0.16, green: 0.11, blue: 0.31), Color(red: 0.43, green: 0.19, blue: 0.27)]
        case 1: return [Color(red: 0.05, green: 0.20, blue: 0.31), Color(red: 0.17, green: 0.35, blue: 0.40)]
        case 2: return [Color(red: 0.24, green: 0.12, blue: 0.18), Color(red: 0.52, green: 0.30, blue: 0.18)]
        case 3: return [Color(red: 0.08, green: 0.16, blue: 0.27), Color(red: 0.26, green: 0.23, blue: 0.52)]
        default: return [Color(red: 0.10, green: 0.23, blue: 0.19), Color(red: 0.33, green: 0.29, blue: 0.17)]
        }
    }
}
