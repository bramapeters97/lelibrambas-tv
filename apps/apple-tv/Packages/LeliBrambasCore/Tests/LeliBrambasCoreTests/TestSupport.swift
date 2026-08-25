import Foundation

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
