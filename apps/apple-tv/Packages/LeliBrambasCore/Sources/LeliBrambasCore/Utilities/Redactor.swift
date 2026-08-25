import Foundation

public enum Redactor {
    public static func email(_ value: String?) -> String {
        guard let value, let at = value.firstIndex(of: "@") else { return "<redacted>" }
        let domain = value[value.index(after: at)...]
        return "<redacted>@\(domain)"
    }

    public static func token(_ value: String?) -> String {
        guard let value, !value.isEmpty else { return "<none>" }
        return "<redacted:\(value.count)>"
    }

    public static func signedURL(_ value: URL?) -> String {
        guard let value else { return "<none>" }
        return "\(value.scheme ?? "https")://\(value.host ?? "<redacted>")/<redacted>"
    }
}
