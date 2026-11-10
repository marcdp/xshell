# Root Module and Application Metadata

The host selects a **root module reference** through `xshell:app.module`:

```html
<meta name="xshell:app.module" content="module:shop:latest">
```

The root module is the entry point for repository dependency resolution and the last module manifest merged into effective configuration. The
application is the result composed from that root, its dependencies, the selected XShell framework, and host configuration. No `main`, `isRoot`,
or `moduleType` field marks a module.

## Root module manifest

The root uses an ordinary module manifest:

```jsonc
{
    "modules": {
        "shop": {
            "label": "Shop",
            "version": "1.0.0",
            "copyright": "",
            "icon": "",
            "defaults": {
                "page": { "renderEngine": "x", "stateEngine": "proxy" },
                "component": { "renderEngine": "x", "stateEngine": "proxy" }
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
            "global": [],
            "definitions": {
                "shop": { "prefix": "shop", "modules": ["shop"] }
            }
        }
    }
}
```

The server copies direct dependencies into the root generation's module version index. Browser bootstrap uses those version-index entries for
recursive discovery. It does not follow `configUrl` fields inside this manifest.

## Effective `config.app`

Bootstrap generates `config.app`; authored manifests must not use it as an application descriptor:

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

| Property | Source and meaning |
| --- | --- |
| `id` | Selected root module id. |
| `label` | Effective root module label, or `""`. |
| `version` | Selected root module version. |
| `copyright` | Effective root copyright, or `""`. |
| `icon` | Effective root icon, or `""`. |
| `basePath` | Host application request-path prefix with trailing slashes removed. |
| `baseUrl` | Absolute application base-directory URL. |
| `params` | Parsed `xshell:app.params`; also replaces the root module's effective `params`. |
| `sources` | All configured repository index URLs, normalized to absolute URLs in configured order. |
| `environment` | Value of `xshell:app.environment`. |

`sources` includes configured repositories that failed to load during this startup. Availability affects resolution, not the recorded host
configuration.

The current `config.schema.json` declares every property above and describes the object as a generated runtime projection. Its current required list
omits `id`, `sources`, and `environment`, even though the host implementation always emits them.

`config.app` does not contain module definitions or XShell subsystem configuration. Those remain in `config.modules` and `config.xshell`.

## Hosting inputs

The current application host inputs are `xshell:app.module`, `xshell:app.basePath`, `xshell:app.params`, `xshell:app.environment`, and repeatable
`xshell:app.source` values. `xshell:app.configPath`, `xshell:source`, and `xshell:xshell.environment` belong to the superseded bootstrap model.

Production root startup generation is not implemented in the current Pack command. Do not infer a production `release.root` contract for the new
repository-driven bootstrap from the legacy Pack code.

See [Module Specification](module.md), [Bootstrap](../10-architecture/10-bootstrap.md), and [Hosting](../10-architecture/40-hosting.md).
