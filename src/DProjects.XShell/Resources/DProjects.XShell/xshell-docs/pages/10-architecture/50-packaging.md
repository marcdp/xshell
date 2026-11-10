# Packaging

XShell has implemented reusable packaging mechanisms, but production **application packaging is not currently integrated with the active
repository-driven host bootstrap**. This page separates those states.

## Implemented development representation

In Development, `ResourcesMiddleware` provides the representation consumed by the active bootstrap:

- a repository index at `/_resources/DProjects.XShell/index.json`;
- one module version index at `/<module-id>/index.json`;
- generation URLs such as `/<module-id>/<version>.dev/manifest.json`; and
- strict-JSON descriptors with generated physical file inventories.

`FilesIndexer` produces sorted package-relative entries containing `path`, `size`, and a lowercase SHA-256 content hash. Development descriptor
generation replaces stale inventory on the owning local module or framework definition without editing the authored JSONC file. Bootstrap then
normalizes the inventory paths into `/_assets/<id>/<generation>/...`.

## Implemented reusable package mechanisms

`Pack.cs`, `FilesIndexer`, and `ModuleFileCompiler` contain working mechanisms for:

- classifying normal-module and XShell framework manifests;
- parsing JSON and JSONC;
- compiling JavaScript, XShell HTML resources, and CSS in staged module trees;
- generating descriptor-embedded inventories;
- creating deterministic ZIP archives;
- deriving content hashes from sorted canonical paths and bytes;
- publishing immutable `<id>/<version>.<hash>/` package directories;
- verifying an existing immutable identity before reuse; and
- installing a `release.json` commit record transactionally after staged packages are published.

The Service Worker can consume a mapping whose physical destination pathname ends in `.zip`. It fetches the complete package, caches package bytes,
parses the supported ZIP subset, and serves individual virtual resource requests. Artifact production and browser package consumption are separate
responsibilities.

## Legacy and incomplete application integration

The application path in `Pack.cs` still models the previous bootstrap architecture:

- dependency discovery recursively follows authored `modules.<id>.configUrl` references;
- dependency descriptors are rewritten with packaged `configUrl` values;
- framework packages expect loose `bootstrap.js` and `sw.js` files;
- root validation expects `xshell:app.configPath` in generated HTML; and
- `BuildRootStartupFiles()` throws `NotImplementedException`.

Consequently, the current command cannot complete a normal root application pack, and its dependency graph is not the repository/version-index
graph used by `bootstrap/index.js`. The repository does not yet implement the production equivalent of the development repository catalog,
version indexes, host-owned `index.js`, and root startup generation.

Do not treat the intended output layout, `release.json` model, or existing Pack tests as proof that repository-driven application packaging works.
Do not publish a replacement production specification until implementation chooses and completes that integration.

Standalone or lower-level packaging paths may exercise parts of the reusable machinery, but that does not establish a deployable application
workflow. In particular, a successful immutable ZIP operation does not mean the active host can discover or start that distribution.

## Current production boundary

The following runtime behavior is implemented independently of Pack's incomplete application integration:

- bootstrap accepts HTTP(S) repository, module-index, manifest, expanded-directory, and ZIP asset URLs subject to browser fetch/CORS and CSP;
- non-Development generations require an index-provided hash and use `<version>.<hash>` virtual paths;
- descriptor inventories are self-contained and require no separate inventory request; and
- the Service Worker supports expanded-directory and ZIP-backed mapping destinations.

These capabilities are building blocks, not an implemented repository-driven publisher or deployment manager. Pack does not upload packages or
configure a hosting environment.

## Authoring rules that remain valid

Modules and the framework may be authored as `manifest.json` or `manifest.jsonc`. Generated `files`, `hash`, `builtAt`, `configUrl`, and
`assets.path` are effective or publication metadata and should not be manually maintained in normal source manifests. A module inventory belongs to
its local `modules.<id>` definition; framework inventory belongs to `xshell.files`.

See [Bootstrap](10-bootstrap.md), [Hosting](40-hosting.md), [Modules](30-modules.md), and [Service Worker](110-service-worker.md).
