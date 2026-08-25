import Foundation
import XCTest
@testable import LeliBrambasCore

enum TestFixtureError: Error {
    case missing(String)
}

enum TestFixtures {
    static func data(named name: String) throws -> Data {
        guard let url = Bundle.module.url(forResource: name, withExtension: "json") else {
            throw TestFixtureError.missing(name)
        }
        return try Data(contentsOf: url)
    }
}

final class LockedBox<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Value?

    func set(_ newValue: Value?) {
        lock.lock()
        value = newValue
        lock.unlock()
    }

    func get() -> Value? {
        lock.lock()
        defer { lock.unlock() }
        return value
    }
}

final class URLProtocolStub: URLProtocol, @unchecked Sendable {
    typealias Handler = (URLRequest) throws -> (HTTPURLResponse, Data)

    private static let lock = NSLock()
    private static var storedHandler: Handler?

    static func install(_ handler: @escaping Handler) {
        lock.lock()
        storedHandler = handler
        lock.unlock()
    }

    static func reset() {
        lock.lock()
        storedHandler = nil
        lock.unlock()
    }

    private static func handler() -> Handler? {
        lock.lock()
        defer { lock.unlock() }
        return storedHandler
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler() else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

func makeStubbedSession() -> URLSession {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [URLProtocolStub.self]
    configuration.httpCookieStorage = nil
    return URLSession(configuration: configuration)
}

func makeHTTPResponse(
    for request: URLRequest,
    status: Int = 200,
    headers: [String: String] = ["Content-Type": "application/json"]
) -> HTTPURLResponse {
    HTTPURLResponse(
        url: request.url!,
        statusCode: status,
        httpVersion: "HTTP/1.1",
        headerFields: headers
    )!
}

func requestBodyData(from request: URLRequest) -> Data? {
    if let body = request.httpBody {
        return body
    }
    guard let stream = request.httpBodyStream else {
        return nil
    }

    stream.open()
    defer { stream.close() }

    var body = Data()
    var buffer = [UInt8](repeating: 0, count: 4_096)
    while true {
        let count = buffer.withUnsafeMutableBufferPointer { pointer in
            guard let baseAddress = pointer.baseAddress else { return 0 }
            return stream.read(baseAddress, maxLength: pointer.count)
        }
        guard count >= 0 else { return nil }
        guard count > 0 else { return body }
        body.append(contentsOf: buffer.prefix(count))
    }
}
