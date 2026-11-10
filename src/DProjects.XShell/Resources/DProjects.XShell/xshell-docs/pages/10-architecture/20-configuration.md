# Configuration

Bootstrap produces one normalized effective configuration:

```js
config = {
    app: {},
    modules: {},
    xshell: {}
};
```

The sections have different responsibilities:

- `config.app` is effective application identity, metadata, parameters, repository sources, and hosting context;
- `config.modules` contains the selected, merged, and normalized module definitions; and
- `config.xshell` contains the selected framework configuration and XShell subsystems.

The selected root module is the entry point of dependency resolution. The application is the composition of that root, its dependencies, the
framework, and host values. `config.app` is only the application's effective metadata view; it is not the whole configuration.

## Authored manifests and indexes

Module specifications are normally authored as `manifest.jsonc`. A representative root definition is:

```jsonc
{
    "modules": {
        "shop": {
            "label": "Shop",
            "version": "1.0.0",
            "copyright": "",
            "icon": "",
            "defaults": {
                "component": { "renderEngine": "x", "stateEngine": "proxy" },
                "page": { "renderEngine": "x", "stateEngine": "proxy" }
            },
            "dependencies": {
                "xshell": "module:xshell:^1.0.0",
                "x": "module:x:latest"
            }
        }
    },
    "xshell": {
        "areas": {
            "default": "shop",
            "definitions": {
                "shop": { "prefix": "shop", "modules": ["shop"] }
            }
        }
    }
}
```

A module manifest may contribute its local module definition and other effective sections such as `xshell`. `ModuleIndexBuilder` copies the local
definition's `dependencies` into that version's repository index entry. Browser discovery follows the version-index dependencies; it does not scan
downloaded manifests for `configUrl` references.

The selected module manifest is the `manifest.json` URL recorded by its chosen version-index entry. Development middleware can generate that strict
JSON response from either an authored `manifest.json` or `manifest.jsonc` file.

## Effective application metadata

Bootstrap generates, rather than authors, `config.app`:

```json
{
  "app": {
    "id": "shop",
    "label": "Shop",
    "version": "1.0.0",
    "copyright": "",
    "icon": "",
    "basePath": "/demo",
    "baseUrl": "https://example.test/demo/",
    "params": { "tenant": "acme" },
    "sources": ["https://example.test/demo/_resources/DProjects.XShell/index.json"],
    "environment": "Development"
  }
}
```

Identity and descriptive fields come from the effective root module. `basePath`, `baseUrl`, `params`, `sources`, and `environment` come from host
inputs. `sources` preserves configured order and includes normalized URLs that were unavailable during bootstrap. The current hosting environment
interface is `xshell:app.environment` → `config.app.environment`; `xshell:xshell.environment` and `config.xshell.environment` are obsolete.

The runtime always emits all fields shown above. The current schema defines them all, although `config.schema.json` does not yet list `id`,
`sources`, or `environment` in the `app.required` array.

## Effective modules and asset locations

A selected module becomes a complete effective `config.modules.<id>` definition. The bootstrap supplies three different location values:

| Property | Meaning |
| --- | --- |
| `configUrl` | Absolute URL of the selected manifest document. |
| `assets.url` | Absolute physical directory or ZIP container URL. |
| `assets.path` | Application-root-relative generation-qualified virtual asset path. |

For example:

```json
{
  "modules": {
    "x": {
      "label": "X",
      "version": "1.2.3",
      "configUrl": "https://repo.example/x/1.2.3.dev/manifest.json",
      "assets": {
        "url": "https://repo.example/x/1.2.3.dev/",
        "path": "/_assets/x/1.2.3.dev"
      },
      "files": [
        { "path": "/_assets/x/1.2.3.dev/components/x-button.js", "size": 1234, "hash": "..." }
      ]
    }
  }
}
```

Development generation names are `<version>.dev`. Other environments require a version-index `hash` and use `<version>.<hash>`. The active host
sets `xshell.assets.basePath` to `/_assets` explicitly. The framework manifest still authors `app:/_assets`, but the current host does not use that
value to select a different virtual namespace.

Physical inventory entries in served manifests are package-relative. Recursive manifest normalization changes their effective copies to virtual
generation paths while preserving `size` and `hash`.

## Path and URL normalization

In effective configuration, a **Path** is application-root-relative, begins with `/`, and has no scheme or origin. A **URL** is fully qualified and
can be passed to browser URL, fetch, or import APIs. For example:

```text
app.basePath = "/demo"
app.baseUrl  = "https://example.test/demo/"
assets.path  = "/_assets/x/1.2.3.dev"
assets.url   = "https://repo.example/x/1.2.3.dev/"
```

Bootstrap recursively normalizes recognized string forms in each selected manifest:

| Authored form | Resolution |
| --- | --- |
| `app:foo` or `app:/foo` | Below `config.app.baseUrl`; escaping the application root is rejected. |
| `url:./foo` | Against the selected physical manifest URL. |
| `/foo` | From the owning module generation's virtual root. |
| `./foo`, `../foo` | From the declaring logical path inside the generation; escaping the generation root is rejected. |
| Absolute scheme | Left unchanged. |
| Other string | Left unchanged. |

`url:` therefore normally creates an absolute physical URL, while `/`, `./`, and `../` create application-relative virtual Paths. Object property
names are not normalized.

## Merge and precedence

Objects merge recursively, arrays concatenate, and later scalar values replace earlier values. The merge order is:

```text
selected XShell framework
    -> dependency modules
    -> modules that depend on them
    -> selected root module
```

Dependency traversal is deterministic and rejects cycles. The root contributes last. The selected framework's
`xshell.resolver.esm.xshell` entry is restored after the merge so the selected framework runtime stays authoritative.

The root module's effective `params` is replaced with the parsed `xshell:app.params` host value. The same object becomes `config.app.params`.

## Generated framework and resolver configuration

Bootstrap fills `xshell.temp.url`, the fixed effective `xshell.assets.basePath`, and resolver rules for selected module generations. File inventories
also generate exact contract and schema entries. Module defaults under `modules.<id>.defaults` select render and state engines for definition-based
resources; they remain distinct from global infrastructure under `xshell.ui`.

Bootstrap then generates `xshell.serviceWorker.mappings`. An authored `mappings` value is replaced, not appended. The effective array describes this
application startup; the worker's durable registry can contain additional generations.

`config.schema.json` describes the final merged object passed to `xshell.init()`, not a partial authored manifest. The host bootstrap does not call
`xshell.validateConfig()` directly. It freezes the effective configuration and calls `xshell.init(config)`; initialization performs schema and
cross-reference validation before constructing the remaining subsystems.

See [Bootstrap](10-bootstrap.md), [Modules](30-modules.md), [Service Worker](110-service-worker.md), and [Specifications](../50-specifications/).
