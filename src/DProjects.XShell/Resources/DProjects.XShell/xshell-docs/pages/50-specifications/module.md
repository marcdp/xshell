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
                "navigation": "/pages"
            },
            "routes": {
                "/orders/{orderId}": "/pages/order.js"
            },
            "contract": { "events": {} }
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
`requires`, `hash`, `builtAt`, `menus`, `routes`, `contract`, and `dependencies`.

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

The optional module-wide `/styles/index.css` and `/module.js` controller are loaded only when their normalized paths occur in the inventory. Styles
use the normal Resolver → Loader path. The controller must default-export a class; optional `start()` and `stop()` methods are lifecycle hooks.

## Required services

`requires` is an optional array of unique nonempty service names:

```jsonc
"requires": ["toast"]
```

After Services finalizes its registry and before any module controller starts, Modules checks that every name exists. The check does not instantiate
a lazy service. `requires` is distinct from repository module `dependencies`, Component/Page resource `dependencies`, and controller service access.

## Menus and routes

`menus` maps names to static arrays, module-relative inventory paths such as `"/pages"`, or registered runtime source names. Areas compose menu
contributions from selected modules; menus are navigation data and do not create dependencies.

`routes` maps Area-relative friendly Path patterns to module-relative Page targets:

```jsonc
"routes": {
    "/orders/{orderId}": "/pages/order.js"
}
```

Route values normalize into the owning module's virtual generation namespace. Route keys remain application navigation patterns and are not
prefixed with Area or application base paths in the module definition. Areas preserve module and declaration order when composing routes;
Navigation performs forward and reverse resolution.

## Module contract

`contract` is optional public metadata using the common contract model. Supported categories include `label`, `description`, `icon`, named `types`,
public `properties`, `events`, `methods`, and `examples`. `module.schema.json` validates this metadata as part of effective configuration.

The contract does not locate or instantiate `module.js`, expose controller functions automatically, dispatch declared events, register a service,
or validate runtime controller behavior.

## Runtime instance

Modules creates one runtime instance for every effective `config.modules` id. It exposes effective params, routes, styles, and the optional
controller. Controllers start in dependency order and stop in reverse order. This runtime object is separate from both the authored and resolved
definition.

See [Root Module and Application Metadata](application.md), [Modules](../10-architecture/30-modules.md),
[Configuration](../10-architecture/20-configuration.md), and [Packaging](../10-architecture/50-packaging.md).
