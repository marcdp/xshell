# Modules

A Module is a reusable configuration and resource unit. The host selects one module reference as the **root module**; repository version metadata
then supplies its recursive dependency graph. The root is the dependency-resolution entry point and final configuration contributor. The
**application** is the composition of the root, its dependencies, the selected XShell framework, and host configuration.

## Four distinct concepts

| Concept | Meaning |
| --- | --- |
| Module reference | `module:<id>:<requirement>` in host metadata or a version-index dependency value. |
| Authored module definition | The local `modules.<id>` object in that module's `manifest.jsonc`. |
| Resolved module definition | Final normalized `config.modules.<id>` selected through repository metadata. |
| Runtime module instance | The one instance created by the Modules subsystem for that effective id. |

Do not use “application,” “root module,” `config.app`, resolved definition, or runtime instance as synonyms.

## Authoring identity and dependencies

A module manifest contains its local definition under its canonical id:

```jsonc
{
    "modules": {
        "orders": {
            "label": "Orders",
            "version": "1.2.3",
            "copyright": "",
            "icon": "",
            "tags": ["business", "order-management"],
            "defaults": {
                "page": { "renderEngine": "x", "stateEngine": "proxy" },
                "component": { "renderEngine": "x", "stateEngine": "proxy" }
            },
            "dependencies": {
                "xshell": "module:xshell:^1.0.0",
                "x": "module:x:latest"
            }
        }
    }
}
```

The key is the module identity. Valid ids match `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`; `xshell` is reserved for the framework. A normal module's id
must also match its immediate directory name when the server builds its index.

`ModuleIndexBuilder` copies the local definition's direct `dependencies` into the module version index. Browser bootstrap recursively follows those
index entries. It does not discover packages from `configUrl` entries inside the downloaded manifest. Dependencies are resolved before dependents,
cycles are rejected during merge, and selecting incompatible generations for one module id is an error.

The current `x-demo/manifest.jsonc` is representative: it defines `modules.x-demo`, declares `module:...` dependencies, and contributes application
composition under `xshell.services.areas.options`.

## Resolution and effective definitions

For every selected generation, bootstrap validates that the manifest contains the expected `modules.<id>` object and matching version. It then
normalizes the complete manifest and merges it into the effective configuration. A manifest can therefore contribute its own module definition and
additional sections such as `xshell` configuration.

The effective module definition includes generated location and inventory metadata:

```json
{
  "label": "Orders",
  "version": "1.2.3",
  "configUrl": "https://repo.example/orders/1.2.3.dev/manifest.json",
  "assets": {
    "url": "https://repo.example/orders/1.2.3.dev/",
    "path": "/_assets/orders/1.2.3.dev"
  },
  "files": []
}
```

`configUrl` identifies the selected descriptor. `assets.url` identifies the physical resource container. `assets.path` identifies the virtual,
generation-qualified application namespace. They are not interchangeable.

Optional module `tags` are authored classification identifiers retained through normalization and merging at `config.modules[id].tags`. They are
not dependencies, Area membership, or public contracts, and they are not inherited by the module's resources.

Merge order is framework first, dependency-first among modules, and root last. Objects merge recursively, arrays concatenate, and later scalar
values replace earlier values. This is whole-manifest composition; the active bootstrap has no separate reference-contribution mechanism.

## Root module and application metadata

The host chooses the root using `xshell:app.module`, for example `module:x-demo:latest`. No `main`, `root`, `isRoot`, or module-type field is stored
in the manifest. The root contributes last, but it remains a module definition in `config.modules`.

Bootstrap separately derives `config.app` from root metadata and host values. `config.app.id` is the root id, while base path, base URL, parameters,
repository sources, and environment describe the composed application's hosting context.

## Runtime module instances

Modules is a declaratively registered runtime service selected by `xshell.services.modules`; its default implementation is
`xshell/services/modules.js`. `Services.init()` registers the implementation metadata, and `Services.initialize("modules")` constructs the singleton
lazily through the standard service injection proxy and awaits its once-only initialization. Application module definitions remain the separate top-level `config.modules` object; they
are not Modules service options.

Startup explicitly initializes Modules. Its `init()` method iterates effective `config.modules` once and creates one runtime record
per id. Repeated dependency requirements therefore do not create multiple runtime module instances. Retrieve a module with
`xshell.modules.getModuleById(id)`; the accessor delegates to the configured singleton, and `xshell.modules.registry` is a frozen inspection
snapshot. Each snapshot file retains its path and size plus a frozen copy of optional generated `resource` metadata, including a separately frozen
tags array when present, so management interfaces can
present inventory descriptions without loading the underlying resource.

Before controllers start, Modules verifies optional `requires` service names against the finalized service registry. It independently discovers
conventional module-wide `/styles/index.css`, `/styles/shared.css`, and `/module.js` resources only when those paths occur in the generated
inventory. Both stylesheet categories load through Resolver → Loader and finish before controllers start. Document-only sheets remain on each
runtime module's `styles` collection. Shared sheets are published as the frozen `xshell.modules.shadowStyleSheets` collection. After controller
startup, Modules preserves previously adopted document sheets, then adopts shared sheets in module order followed by document-only sheets in
module order. The exact shared objects are reused by XShell-managed Component and native `x-page` Shadow Roots before their local sheets. The
existing `shadowStyleSheets` API name remains, while `shared.css` reflects that the resource applies to both the document and managed Shadow Roots.
Document normalization remains exclusively in `index.css`; shared sheets contain visual defaults, and each Component owns any normalization its
internal implementation requires.

Controllers start sequentially in dependency order and stop in reverse order. A controller receives `moduleAssetsPath`, `moduleConfig`, and named
services; its optional `start()` and `stop()` methods are lifecycle hooks. XShell resolves Areas before module controllers start, awaits Modules
initialization, composes Areas from that initialized singleton, and initializes Navigation afterward.

## Menus, routes, Areas, and services

Module menu and route declarations are reusable contributions. Each named [menu definition](../50-specifications/module.md#menus-and-routes)
can supply a composition scope, display metadata, root items, or an Area menu source. Areas composes global menus once across all selected modules
and composes Area-scoped menus from each Area's participating modules. Area membership leaves the dependency graph and runtime module count
unchanged. Scope affects composition rather than lookup: `Areas.getMenu()` and `Areas.getMenus()` expose both Area and global effective definitions,
while route resolution, breadcrumbs, and Area home calculation continue using Area-scoped menus only. Routes map Area-relative friendly paths to
normalized canonical Page Paths.

Modules are composition units and do not define public contracts. A module may provide multiple Services, each with its own contract describing
public properties, methods, and published Bus events. Components and Pages have their own public contracts. Optional `requires` names services and
is distinct from repository module dependencies and from a Component or Page implementation's resource `dependencies`.

See [Module Specification](../50-specifications/module.md), [Configuration](20-configuration.md), [Areas](../30-subsystems/10-areas.md), and
[Service Worker](110-service-worker.md).

## Packaging boundary

The current Pack command still follows legacy authored `configUrl` references when discovering local filesystem dependencies. That behavior is not
the browser's repository-driven module-resolution model. Application packaging is incomplete because root startup generation is not implemented;
see [Packaging](50-packaging.md).
