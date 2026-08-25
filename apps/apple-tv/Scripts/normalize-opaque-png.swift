#!/usr/bin/env swift

import CoreGraphics
import Darwin
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum NormalizationError: LocalizedError {
    case invalidArguments
    case unreadableSource
    case contextCreationFailed
    case imageCreationFailed
    case destinationCreationFailed
    case writeFailed

    var errorDescription: String? {
        switch self {
        case .invalidArguments:
            "Usage: normalize-opaque-png.swift <source.png> <destination.png>"
        case .unreadableSource:
            "The source image could not be decoded."
        case .contextCreationFailed:
            "An opaque RGB drawing context could not be created."
        case .imageCreationFailed:
            "The normalized image could not be created."
        case .destinationCreationFailed:
            "The PNG destination could not be created."
        case .writeFailed:
            "The normalized PNG could not be written."
        }
    }
}

func normalizeOpaquePNG(sourceURL: URL, destinationURL: URL) throws {
    guard
        let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        throw NormalizationError.unreadableSource
    }

    guard
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
        let context = CGContext(
            data: nil,
            width: image.width,
            height: image.height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue
                | CGImageAlphaInfo.noneSkipLast.rawValue
        )
    else {
        throw NormalizationError.contextCreationFailed
    }

    let bounds = CGRect(
        x: 0,
        y: 0,
        width: CGFloat(image.width),
        height: CGFloat(image.height)
    )
    context.setFillColor(CGColor(gray: 0, alpha: 1))
    context.fill(bounds)
    context.interpolationQuality = .none
    context.translateBy(x: 0, y: CGFloat(image.height))
    context.scaleBy(x: 1, y: -1)
    context.draw(image, in: bounds)

    guard let normalizedImage = context.makeImage() else {
        throw NormalizationError.imageCreationFailed
    }

    guard let destination = CGImageDestinationCreateWithURL(
        destinationURL as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        throw NormalizationError.destinationCreationFailed
    }

    CGImageDestinationAddImage(destination, normalizedImage, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NormalizationError.writeFailed
    }
}

do {
    guard CommandLine.arguments.count == 3 else {
        throw NormalizationError.invalidArguments
    }

    try normalizeOpaquePNG(
        sourceURL: URL(fileURLWithPath: CommandLine.arguments[1]),
        destinationURL: URL(fileURLWithPath: CommandLine.arguments[2])
    )
} catch {
    FileHandle.standardError.write(Data("Screenshot normalization failed: \(error.localizedDescription)\n".utf8))
    exit(EXIT_FAILURE)
}
