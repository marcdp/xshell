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
            "requires": ["toast"],
            "defaults": {
                "page": { "renderEngine": "x", "stateEngine": "proxy" },
                "component": { "renderEngine": "x", "stateEngine": "proxy" }
            },
            "dependencies": {
                "xshell": "module:xshell:^1.0.0",
                "x": "module:x:latest"
            },
            "menus": {
                "navigation": { "label": "Orders", "source": "/pages" }
            },
            "routes": {
                "/orders/{orderId}": "/pages/order.js"
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

The effective schema requires `label`, `version`, `copyright`, `icon`, `configUrl`, `assets`, `defaults`, and `files`. It permits `params`,
`requires`, `hash`, `builtAt`, `menus`, `routes`, and `dependencies`.

| Property | Meaning |
| --- | --- |
| `configUrl` | Absolute URL of the selected manifest document. |
| `assets.url` | Absolute physical directory or ZIP container; authored `url:./` is the normal default. |
| `assets.path` | Generated virtual generation root under `/_assets`. |
| `files` | Effective virtual resource inventory, with `path`, `size`, and `hash`. |
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

The controller must default-export a class; optional `start()` and `stop()` methods are lifecycle hooks.

## Required services

`requires` is an optional array of unique nonempty service names:

```jsonc
"requires": ["toast"]
```

After Services finalizes its registry and before any module controller starts, Modules checks that every name exists. The check does not instantiate
a lazy service. `requires` is distinct from repository module `dependencies`, Component/Page resource `dependencies`, and controller service access.

## Menus and routes

`menus` maps names to menu definitions. The dictionary key is the menu name. Each module can supply any of these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `scope` | `"global"` or `"area"` | Composition scope shared by all contributions with this menu name. Defaults to `"area"` if every contribution omits it. |
| `label` | string | Menu title |
| `description` | string | Menu description |
| `icon` | string or null | Menu icon |
| `items` | array of menu items | Static root entries. Nested entries use `children` on the parent item. |
| `source` | nonempty string | Module-relative inventory path such as `"/pages"` or a registered runtime source name. Available for Area menus. |

Areas discovers global menus from the selected module definitions and composes them in configuration module order. Each Area composes its own
Area-scoped menus in participation order. A module can extend a menu without declaring its scope again. Explicit scopes for the same name must
agree, or Areas rejects the configuration.

Scope selects that composition model; it does not select a public lookup method. `areas.getMenu(name, areaId)` prefers the requested/current Area
definition and falls back to the global definition, while `areas.getMenus(areaId)` returns Area definitions first and global definitions afterward.
An unknown explicit Area returns `null` or `[]`, respectively, without global fallback.

Later supplied metadata overrides earlier values, and omitted metadata keeps its earlier value. Root items from each contribution merge
recursively by item ID, with explicit items processed before resolved source items. See [Areas](../30-subsystems/10-areas.md#menus-and-home) for
ordering, normalization, and effective menu APIs.

`routes` maps Area-relative friendly Path patterns to module-relative Page targets:

```jsonc
"routes": {
    "/orders/{orderId}": "/pages/order.js"
}
```

Route values normalize into the owning module's virtual generation namespace. Route keys remain application navigation patterns and are not
prefixed with Area or application base paths in the module definition. Areas preserve module and declaration order when composing routes;
Navigation performs forward and reverse resolution.

## Public contracts

Modules do not define public contracts. `module.schema.json` rejects a `contract` property on an effective module definition. A module may provide
multiple Services, each with its own contract describing public properties, methods, and published Bus events. Components and Pages retain their
own public contracts. Module controller `start()` and `stop()` methods remain internal lifecycle hooks.

## Runtime instance

Modules creates one runtime instance for every effective `config.modules` id. It exposes effective params, routes, document `styles`, and the
optional controller. The Modules service exposes the frozen ordered `shadowStyleSheets` collection separately; that API name is retained while
the conventional resource is `styles/shared.css`. Controllers start in dependency order and stop in reverse order. This runtime object is
separate from both the authored and resolved definition.

See [Root Module and Application Metadata](application.md), [Modules](../10-architecture/30-modules.md),
[Configuration](../10-architecture/20-configuration.md), and [Packaging](../10-architecture/50-packaging.md).
