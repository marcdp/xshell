# Module Configuration Specification

A normal module is authored in `manifest.json` or, preferably, `manifest.jsonc`, with its local definition under `modules.<id>`. The active browser
selects that document through repository metadata rather than discovering it through another manifest.

## Module identity

A module id is a case-sensitive canonical identifier matching:

```regex
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

It begins with a lowercase ASCII letter and otherwise uses lowercase letters, decimal digits, and nonrepeating, nonterminal hyphens. `xshell` is
reserved for the framework. Development index generation also requires a normal module id to equal its immediate directory name.

Do not duplicate identity in `name`, `id`, or `moduleId`; the `modules` property key is authoritative.

## Authored local definition

```jsonc
{
    "modules": {
        "orders": {
            "label": "Orders",
            "version": "1.2.3",
            "copyright": "",
            "icon": "",
            "tags": ["business", "order-management"],
            "requires": ["toast"],
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

`ModuleIndexBuilder` identifies the local definition, validates its version, and copies `dependencies` into the generated module version index.
The browser resolves those index dependencies recursively. A dependency key is the expected module id and its value is a
`module:<id>:<requirement>` reference.

The browser supports exact stable versions, `latest`, and fully specified caret or tilde requirements. The C# builder accepts a wider semantic
version grammar for manifest versions, including prerelease and build metadata, but the browser selector only selects plain stable
`major.minor.patch` version keys.

The active browser does not treat other `modules.<id>.configUrl` objects as package-discovery instructions. The current Pack command still does so
as legacy behavior; that production application-pack path is incomplete.

## Normalized effective module

After selection, bootstrap merges the manifest and enriches the selected definition:

```json
{
  "label": "Orders",
  "version": "1.2.3",
  "copyright": "",
  "icon": "",
  "configUrl": "https://repo.example/orders/1.2.3.dev/manifest.json",
  "assets": {
    "path": "/_assets/orders/1.2.3.dev",
    "url": "https://repo.example/orders/1.2.3.dev/"
  },
  "dependencies": {
    "xshell": "module:xshell:^1.0.0",
    "x": "module:x:latest"
  },
  "files": [],
  "defaults": {
    "page": { "renderEngine": "x", "stateEngine": "proxy" },
    "component": { "renderEngine": "x", "stateEngine": "proxy" }
  }
}
```

The effective schema requires `label`, `version`, `copyright`, `icon`, `configUrl`, `assets`, `defaults`, and `files`. It permits `tags`, `params`,
`requires`, `hash`, `builtAt`, and `dependencies`.

| Property | Meaning |
| --- | --- |
| `configUrl` | Absolute URL of the selected manifest document. |
| `assets.url` | Absolute physical directory or ZIP container; authored `url:./` is the normal default. |
| `assets.path` | Generated virtual generation root under `/_assets`. |
| `tags` | Optional authored lowercase kebab-case module classifications, retained at `config.modules[id].tags`. |
| `files` | Effective virtual resource inventory, with required `path`, `size`, and `hash`, plus optional generated `resource` metadata. |
| `dependencies` | Authored dependency declarations retained as module metadata; index copies drive discovery. |

Development paths use `<version>.dev`. Non-Development paths require an index-provided package hash and use `<version>.<hash>`.

## Configuration URL expressions

Bootstrap recursively normalizes recognized strings in a selected manifest:

- `app:` resolves below the application base URL;
- `url:` resolves against the selected physical manifest URL;
- `/` resolves from the owning module's virtual generation root;
- `./` and `../` resolve from the declaring logical path without escaping that root;
- absolute schemes remain unchanged; and
- other strings remain unchanged.

This means `configUrl`, `assets.url`, and `assets.path` describe different addressing layers. Runtime module resources normally use the virtual
`assets.path`, not the physical manifest or asset-container URL.

## Inventories and conventional resources

Development middleware generates package-relative `files` entries in the served descriptor; bootstrap converts their effective copies to virtual
generation paths. Authors should not maintain `files` manually.

Every file remains authoritative physical inventory data. Recognized resources additionally receive a small generated projection:

```json
{
  "path": "/pages/orders.js",
  "size": 4230,
  "hash": "...",
  "resource": {
    "type": "page",
    "title": "Orders",
    "description": "Review current orders.",
    "icon": "x-orders",
    "tags": ["navigation", "order-management"]
  }
}
```

Command and Component entries use the same file shape with their own small projections:

```json
{
  "path": "/commands/orders.refresh.js",
  "size": 1240,
  "hash": "...",
  "resource": { "type": "command", "label": "Refresh orders", "description": "Reload current orders." }
}
```

```json
{
  "path": "/components/orders-grid.js",
  "size": 2150,
  "hash": "...",
  "resource": { "type": "component", "label": "Orders grid", "description": "Displays orders in a grid." }
}
```

Supported types are `page`, `component`, `command`, `query`, `contract`, and `schema`. Page metadata contains `title`, `description`, and `icon`.
Component, Command, Query, and contract metadata uses `label`, `description`, and `icon`. Schema metadata uses `id`, `title`, and `description`.
JavaScript Pages, Components, Commands, and Queries plus standalone JSON contracts may also contain `tags` in authored declaration order. All
descriptive fields are optional. Component metadata prefers `meta.title`, `meta.description`, and `meta.icon`, falling back individually to the corresponding
`contract.label`, `contract.description`, and `contract.icon`. The inventory never embeds full contracts, schemas, templates, or datasets.

Module tags and resource tags are independent. Module tags are authored directly on the module definition and are never inherited by contained
resources. Resource tags are authored on the public resource contract, never inferred from filenames or directories, and generated automatically
as `file.resource.tags`. Both use unique lowercase kebab-case identifiers, allow an empty array, preserve order, and have no automatic runtime
behavior.

A JavaScript file under `/commands/` is a valid generated Command resource only when it default-exports a static definition object whose static
`contract` object contains a static `execute` object. Packaging reads this shape without executing JavaScript and reports the source path when the
required structure, optional descriptive strings, or `contract.tags` are dynamic or malformed. Static tag extraction accepts quoted strings,
comments, multiline arrays, escaped literals, empty arrays, and trailing commas without executing JavaScript.

A `/queries/*.js` file follows the same static metadata rules. Its definition contains `contract.query` and `contract.query.returns` objects.
The same rule applies in subdirectories. See [Queries](../30-subsystems/95-queries.md#discover-queries) for discovery and identifier conventions.

`module.files` remains the authoritative enumeration of packaged resources. `file.resource` permits discovery and presentation without loading an
implementation, but it is not a resource catalog or registry. Resolver and Loader continue to resolve and load the underlying file.
The Modules service's frozen inspection registry copies this optional metadata onto its file snapshots; this projection does not alter resolution
or loading behavior.

The optional module-wide `/styles/index.css`, `/styles/shared.css`, and `/module.js` controller are loaded only when their normalized paths occur in
the inventory. Authors do not declare either stylesheet in the manifest. Both stylesheets use the normal Resolver → Loader path, including CSS
`@import` expansion and resource-URL rewriting:

- `styles/index.css` is adopted only by the document. It owns browser normalization, document-specific selectors, custom properties and design
  tokens, themes, and application layout rules.
- `styles/shared.css` is adopted by the document, every XShell-managed Component Shadow Root, and the native `x-page` Shadow Root. It supplies
  shared visual defaults such as typography and element presentation, but no browser reset. XShell does not inject it into arbitrary third-party
  Web Components.

Each file is optional and discovered independently, so a module may provide either, both, or neither. Previously adopted document sheets remain
first, followed by all `shared.css` sheets in effective module order and then all `index.css` sheets in that order. Managed Shadow Roots adopt the
same shared sheet objects before Component or native `x-page` local sheets. Later document-specific and Component-specific rules therefore
participate in the normal cascade without refetching or reparsing shared CSS. CSS custom properties set on the document continue to inherit through
Component hosts, while document CSS rules and the document reset do not cross a shadow boundary. Components own any normalization required by
their internal implementation. Styling exposed shadow content still follows platform rules: use a component's supported `::part`, `::slotted`,
or custom-property API, and note that `::slotted` reaches only directly assigned nodes.

The controller must default-export a class. Its constructor receives `moduleAssetsPath`, `moduleConfig`, its Module-controller Services scope as
`services`, and ordinary named dependencies resolved through that scope. Each controller gets one independent direct child of the application
root: singletons remain application-wide, scoped services have one instance per Module controller, and transients are created per resolution.
Optional `start()` and `stop()` methods run while the scope is active; Modules disposes the scope after `stop()` completes. Modules without a
controller create no scope, and Module scopes remain independent of Page, Component, and Command scopes.

## Required services

`requires` is an optional array of unique nonempty service names:

```jsonc
"requires": ["toast"]
```

After Services finalizes its registry and before any module controller starts, Modules checks that every name exists. The check does not instantiate
a lazy service. `requires` is distinct from repository module `dependencies`, Component/Page resource `dependencies`, and controller service access.

## Menus and routes

Module manifests can contribute named application menus through `xshell.services.menus.options.definitions`. Areas explicitly select these
definitions for their menu slots. See [Menus and home](../30-subsystems/10-areas.md#menus-and-home) for the options and lookup APIs.

Module manifests can also extend `xshell.services.areas.options.definitions.<area-id>.routes`. Route keys are Area-relative application patterns.
Bootstrap normalizes their Page targets against the declaring manifest before merging. Distinct patterns retain order, and a later value
for the same pattern replaces the earlier value in place. See [Area routes](../30-subsystems/10-areas.md#routes).

## Public contracts

Modules do not define public contracts. `module.schema.json` rejects a `contract` property on an effective module definition. A module may provide
multiple Services, each with its own contract describing public properties, methods, and published Bus events. Components and Pages retain their
own public contracts. Module controller `start()` and `stop()` methods remain internal lifecycle hooks.

## Runtime instance

Modules creates one runtime instance for every effective `config.modules` id. It exposes effective params, document `styles`, and the
optional controller. The Modules service exposes the frozen ordered `shadowStyleSheets` collection separately; that API name is retained while
the conventional resource is `styles/shared.css`. Controllers start in dependency order and stop in reverse order. Controller scopes remain
private to the Modules service and are not exposed on this runtime object, which is separate from both the authored and resolved definition.

See [Root Module and Application Metadata](application.md), [Modules](../10-architecture/30-modules.md),
[Configuration](../10-architecture/20-configuration.md), and [Packaging](../10-architecture/50-packaging.md).
