import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import LeliBrambasCore
import SwiftUI
import UIKit

struct DeviceActivationView: View {
    let challenge: ActivationChallenge?
    let isWorking: Bool
    let error: AppError?
    let onStart: () -> Void
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            LBBackground()
            HStack(spacing: 86) {
                introduction
                activationPanel
            }
            .frame(maxWidth: 1500)
            .padding(.horizontal, LBSpacing.safeHorizontal)
        }
        .accessibilityIdentifier("activation-screen")
    }

    private var introduction: some View {
        VStack(alignment: .leading, spacing: LBSpacing.medium) {
            HStack(spacing: 18) {
                LBLogo(size: 64)
                LBWordmark(compact: true)
            }
            Text("Your private cinema, on the biggest screen.")
                .font(.system(size: 52, weight: .heavy, design: .rounded))
                .foregroundStyle(LBColor.text)
                .lineSpacing(-2)
                .frame(maxWidth: 720, alignment: .leading)
            Text("Activate this Apple TV from a phone or computer. Your email and one-time PIN stay in the protected browser flow; no reusable Cloudflare credential is stored in the app.")
                .font(.system(size: 25, weight: .regular, design: .rounded))
                .foregroundStyle(LBColor.textSecondary)
                .lineSpacing(6)
                .frame(maxWidth: 700, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var activationPanel: some View {
        VStack(spacing: LBSpacing.medium) {
            if let challenge {
                if let codeImage = QRCodeGenerator.image(for: challenge.verificationURLComplete ?? challenge.verificationURL) {
                    Image(uiImage: codeImage)
                        .interpolation(.none)
                        .resizable()
                        .frame(width: 250, height: 250)
                        .padding(18)
                        .background(Color.white, in: RoundedRectangle(cornerRadius: LBRadius.medium, style: .continuous))
                        .accessibilityLabel("QR code for activation")
                        .accessibilityIdentifier("activation-qr-code")
                }
                Text("ENTER THIS CODE")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .tracking(3.2)
                    .foregroundStyle(LBColor.gold)
                Text(challenge.userCode)
                    .font(.system(size: 58, weight: .black, design: .monospaced))
                    .tracking(7)
                    .foregroundStyle(LBColor.text)
                    .accessibilityIdentifier("activation-user-code")
                Text(shortURL(challenge.verificationURL))
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .foregroundStyle(LBColor.cyan)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .accessibilityIdentifier("activation-url")
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    Text(expiryLabel(challenge, now: context.date))
                        .font(.system(size: 20, weight: .medium, design: .rounded))
                        .foregroundStyle(LBColor.textMuted)
                }
                HStack(spacing: LBSpacing.medium) {
                    ProgressView().tint(LBColor.cyan)
                    Text("Waiting for approval…")
                        .foregroundStyle(LBColor.textSecondary)
                }
                LBSecondaryButton(action: onCancel) {
                    Text("Cancel")
                }
                .accessibilityIdentifier("activation-cancel")
            } else {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 66, weight: .semibold))
                    .foregroundStyle(LBColor.cyan)
                Text("Secure activation")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .foregroundStyle(LBColor.text)
                Text("We’ll show a short code and QR code for the protected sign-in page.")
                    .font(.system(size: 23, design: .rounded))
                    .foregroundStyle(LBColor.textSecondary)
                    .multilineTextAlignment(.center)
                LBPrimaryButton(action: onStart) {
                    if isWorking {
                        ProgressView().tint(LBColor.canvas)
                    } else {
                        Label("Activate Apple TV", systemImage: "link")
                    }
                }
                .disabled(isWorking)
                .accessibilityIdentifier("activation-start")
            }

            if let error {
                VStack(spacing: 7) {
                    Text(error.title)
                        .font(.system(size: 21, weight: .bold, design: .rounded))
                    Text(error.message)
                        .font(.system(size: 18, design: .rounded))
                }
                .foregroundStyle(LBColor.rose)
                .multilineTextAlignment(.center)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("activation-error")
            }
        }
        .padding(46)
        .frame(width: 560, minHeight: 620)
        .background(LBColor.surface.opacity(0.93), in: RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: LBRadius.large, style: .continuous)
                .stroke(LBColor.text.opacity(0.1), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.42), radius: 34, y: 22)
    }

    private func shortURL(_ url: URL) -> String {
        guard let host = url.host else { return url.absoluteString }
        let path = url.path == "/" ? "" : url.path
        return host + path
    }

    private func expiryLabel(_ challenge: ActivationChallenge, now: Date) -> String {
        let seconds = max(0, Int(challenge.expiresAt.timeIntervalSince(now)))
        return String(format: "Code expires in %d:%02d", seconds / 60, seconds % 60)
    }
}

private enum QRCodeGenerator {
    private static let context = CIContext(options: [.useSoftwareRenderer: false])

    static func image(for url: URL) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(url.absoluteString.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)),
              let cgImage = context.createCGImage(output, from: output.extent) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }
}
