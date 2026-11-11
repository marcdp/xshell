# Bundled dependencies

The XVault compatibility implementation follows `marcdp/xvault` at commit `e2c6ebf7edd2c72192ca4c8f160ab435b5ba9fd0`.
Its upstream MIT license is retained in `python-xvault.LICENSE`.

These browser ES modules are bundled without minification or changes to the upstream algorithms:

| Output | Upstream | Version | License |
| --- | --- | --- | --- |
| `argon2.js` | https://github.com/paulmillr/noble-hashes | 2.4.0 | MIT (`noble-hashes.LICENSE`) |
| `yaml.js` | https://github.com/eemeli/yaml | 2.8.1 | ISC (`yaml.LICENSE`) |
| `json5.js` | https://github.com/json5/json5 | 2.2.3 | MIT (`json5.LICENSE`) |

`sources.json` records the npm tarball locations and integrity hashes, including esbuild 0.25.12 used to bundle them.
Run `build.ps1` to reproduce the bundles. Node/npm and network access are needed only for rebuilding vendor assets.
The application imports the checked-in local files through normal XShell resource inventories. No CDN, WASM, eval, or Python is used at runtime.

Only `argon2idAsync`, `parseDocument`/`isMap`/`isScalar`, and JSON5's default export are exposed by these bundles.
The Argon2 implementation yields to the event loop and clears its working memory. Its fixed XVault parameters still require approximately
128 MiB per concurrent derivation; callers should avoid opening many vaults concurrently.
