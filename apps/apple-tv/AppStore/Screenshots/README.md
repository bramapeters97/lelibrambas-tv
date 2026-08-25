# Generated screenshots

`Scripts/capture-app-store-screenshots.sh` writes reviewed app candidates to `1920x1080/` or `3840x2160/`, matching the simulator's native framebuffer, and keeps its separate tvOS Home-screen proof under ignored `BuildArtifacts/SimulatorPreview/`. Generated PNGs are local release artifacts and should not be committed if they contain any private or production content. See `../SCREENSHOT_PLAN.md`.
