# Protected repository paths

Recorded task base commit: `744491eeffeb9f64eead66397c8df59466f8b16e`

The native Apple TV work is additive. The following pre-existing areas are read-only for this effort:

| Area                                     | Protected paths                                                        | Why                                                          |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Web/React viewer and existing Expo entry | `apps/tv/**`                                                           | Production web UI and pre-existing native prototype          |
| Windows portable desktop shell           | `apps/desktop/**`                                                      | Electron main/preload, security policy, packaging, and tests |
| Shared JavaScript packages               | `packages/**`                                                          | Used by existing applications                                |
| Existing backend and infrastructure      | `services/api/**`, `infra/**`, root `wrangler.jsonc`                   | Existing Cloudflare adapters/configuration                   |
| Import pipeline                          | `tools/video-importer/**`                                              | Source-preserving media import path                          |
| Root build and dependency graph          | root `package.json`, `yarn.lock`, `scripts/**`                         | Existing Node/Yarn toolchain                                 |
| Portfolio/publication surface            | root `index.html`, existing root assets and GitHub Pages configuration | Must remain unpublished and unchanged                        |
| Existing automation                      | all pre-existing `.github/workflows/**`                                | Existing CI is not part of the tvOS task                     |

The isolation checker permits changes only under:

- `apps/apple-tv/**`;
- the one new `.github/workflows/tvos-ci.yml` workflow;
- the optional new `services/apple-tv-gateway/**` service.

Run from `apps/apple-tv`:

```bash
./Scripts/assert-repository-isolation.sh
```

Pass another valid comparison commit as the first argument when deliberately auditing a narrower change. The script also includes tracked working-tree changes and untracked files so it is useful before commit.
