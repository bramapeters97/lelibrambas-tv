import Foundation
import Security

public protocol SessionStoring: Sendable {
    func load() throws -> SessionRecord?
    func save(_ session: SessionRecord) throws
    func clear() throws
}

public enum SessionStoreError: Error, Equatable, Sendable {
    case encoding
    case keychain(OSStatus)
}

public final class KeychainSessionStore: SessionStoring, @unchecked Sendable {
    private let service: String
    private let account: String

    public init(service: String = "com.lelibrambas.plus.session", account: String = "viewer") {
        self.service = service
        self.account = account
    }

    public func load() throws -> SessionRecord? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw SessionStoreError.keychain(status)
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let session = try? decoder.decode(SessionRecord.self, from: data) else {
            throw SessionStoreError.encoding
        }
        return session
    }

    public func save(_ session: SessionRecord) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(session) else { throw SessionStoreError.encoding }
        let status: OSStatus
        if try load() == nil {
            var query = baseQuery
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            status = SecItemAdd(query as CFDictionary, nil)
        } else {
            status = SecItemUpdate(
                baseQuery as CFDictionary,
                [kSecValueData as String: data] as CFDictionary
            )
        }
        guard status == errSecSuccess else { throw SessionStoreError.keychain(status) }
    }

    public func clear() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SessionStoreError.keychain(status)
        }
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

public final class MemorySessionStore: SessionStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var value: SessionRecord?

    public init(value: SessionRecord? = nil) { self.value = value }

    public func load() throws -> SessionRecord? {
        lock.lock(); defer { lock.unlock() }
        return value
    }

    public func save(_ session: SessionRecord) throws {
        lock.lock(); defer { lock.unlock() }
        value = session
    }

    public func clear() throws {
        lock.lock(); defer { lock.unlock() }
        value = nil
    }
}
