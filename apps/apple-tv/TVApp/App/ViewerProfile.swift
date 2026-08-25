import SwiftUI

struct ViewerProfile: Identifiable, Hashable {
    let id: String
    let name: String
    let initials: String
    let accentHex: String

    var accent: Color {
        switch accentHex {
        case "#70D8FF": return LBColor.cyan
        case "#8275FF": return LBColor.indigo
        case "#E9C778": return LBColor.gold
        default: return LBColor.cyan
        }
    }

    static let all: [ViewerProfile] = [
        ViewerProfile(
            id: "bart-astrid",
            name: "Bart & Astrid",
            initials: "BA",
            accentHex: "#70D8FF"
        ),
        ViewerProfile(
            id: "bram-edvin",
            name: "Bram & Edvin",
            initials: "BE",
            accentHex: "#8275FF"
        ),
        ViewerProfile(
            id: "eline-luca",
            name: "Eline & Luca",
            initials: "EL",
            accentHex: "#E9C778"
        ),
    ]
}
