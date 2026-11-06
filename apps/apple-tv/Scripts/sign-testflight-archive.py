#!/usr/bin/env python3
"""Finish an opted-in local archive with App Store signing; never upload."""

import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import tempfile


def run(*args):
    try:
        return subprocess.check_output(args, stderr=subprocess.STDOUT, text=True)
    except subprocess.CalledProcessError as error:
        print(error.output, flush=True)
        raise


def main():
    if os.environ.get("LB_SIGN_ARCHIVE_FOR_DISTRIBUTION") != "YES":
        return
    if os.environ.get("LB_UNSIGNED_CI_VALIDATION") == "YES":
        return
    archive = Path(os.environ["ARCHIVE_PATH"]).resolve()
    root = Path(__file__).resolve().parent.parent
    # Read only the local team setting, never account credentials.
    config = (root / "Config/Signing.xcconfig").read_text()
    match = re.search(r"^DEVELOPMENT_TEAM\s*=\s*([A-Z0-9]{10})\s*$", config, re.M)
    if not match:
        raise RuntimeError("Set DEVELOPMENT_TEAM in local Config/Signing.xcconfig")
    team = match.group(1)
    info_path = archive / "Info.plist"
    info = plistlib.loads(info_path.read_bytes())
    app = archive / "Products" / info["ApplicationProperties"]["ApplicationPath"]
    artifacts = root / "BuildArtifacts"
    artifacts.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="distribution-", dir=artifacts) as temp:
        work = Path(temp)
        options = work / "ExportOptions.plist"
        options.write_bytes(plistlib.dumps({
            "method": "app-store-connect", "destination": "export",
            "signingStyle": "automatic", "teamID": team,
            "manageAppVersionAndBuildNumber": False, "uploadSymbols": True,
        }))
        print(run("xcodebuild", "-exportArchive", "-archivePath", str(archive),
                  "-exportPath", str(work / "export"), "-exportOptionsPlist",
                  str(options), "-allowProvisioningUpdates"), flush=True)
        ipa, = (work / "export").glob("*.ipa")
        run("ditto", "-x", "-k", str(ipa), str(work / "unpacked"))
        signed, = (work / "unpacked/Payload").glob("*.app")
        run("codesign", "--verify", "--deep", "--strict", str(signed))
        signature = run("codesign", "-dv", "--verbose=2", str(signed))
        if f"TeamIdentifier={team}\n" not in signature:
            raise RuntimeError("Export signature has an unexpected team")
        identity = next(line.split("=", 1)[1] for line in signature.splitlines()
                        if line.startswith("Authority=Apple Distribution:"))
        original_info = plistlib.loads((app / "Info.plist").read_bytes())
        signed_info = plistlib.loads((signed / "Info.plist").read_bytes())
        for key in ("CFBundleIdentifier", "CFBundleVersion", "CFBundleShortVersionString"):
            if original_info[key] != signed_info[key]:
                raise RuntimeError(f"Export changed {key}")
        binary = original_info["CFBundleExecutable"]
        def uuids(path):
            return re.findall(r"UUID: ([A-F0-9-]+) \(([^)]+)\)",
                              run("dwarfdump", "--uuid", str(path)))
        if not uuids(app / binary) or uuids(app / binary) != uuids(signed / binary):
            raise RuntimeError("Exported binary does not match archive debug symbols")
        # Preserve the original app until replacement and metadata both succeed.
        backup = work / "original.app"
        shutil.move(str(app), str(backup))
        try:
            run("ditto", str(signed), str(app))
            run("codesign", "--verify", "--deep", "--strict", str(app))
            info["ApplicationProperties"]["Team"] = team
            info["ApplicationProperties"]["SigningIdentity"] = identity
            pending = info_path.with_suffix(".pending")
            pending.write_bytes(plistlib.dumps(info))
            pending.replace(info_path)
        except Exception:
            if app.exists():
                shutil.rmtree(app)
            shutil.move(str(backup), str(app))
            raise
    print("Archive distribution signature and team verified. Nothing uploaded.", flush=True)


if __name__ == "__main__":
    main()
