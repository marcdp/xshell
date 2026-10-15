# ASP.NET Hosting

`app.UseXShell(configuration)` installs resource/Temp middleware, generated bootstrap files, and SPA fallback.

```csharp
using DProjects.XShell;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/api/health", () => "ok");
app.UseXShell(new Extensions.Configuration {
    App = new Extensions.AppConfig {
        Description = "",
        BasePath = "",
        ConfigPath = "/_resources/DProjects.XShell/x-demo/module.jsonc",
        Params = new Dictionary<string, string>()
    },
    Resources = new Extensions.ResourcesConfig {
        BasePath = "/_resources/DProjects.XShell",
        ResourceName = "DProjects.XShell"
    },
    XShell = new Extensions.XShellConfig {
        BasePath = "/_resources/DProjects.XShell/xshell"
    },
    Server = new Extensions.ServerConfig {
        Environment = null,
        ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; ",
        UnhandledPrefixes = new[] { "/_", "/api", "/temp" }
    },
    Temp = new Extensions.TempConfig {
        Path = Path.Combine(Path.GetTempPath(), "DProjects.XShell", "temp"),
        BasePath = "/temp",
        ExpirationTime = TimeSpan.FromHours(1),
        FileSizeLimit = 100 * 1024 * 1024
    }
});
app.Run();
```

## Configuration

| Setting | Default and effect |
| --- | --- |
| `App.Description` | `""`; HTML description meta value. |
| `App.BasePath` | `""`; valid root hosting. A nonempty value must be a rooted request path such as `/app`. |
| `App.ConfigPath` | `""` is a placeholder rejected by `UseXShell()`; supply a nonempty root module configuration path or URL. |
| `App.Params` | Empty string dictionary; host params become root-module/application params. |
| `Resources.BasePath` | `""` is a placeholder rejected by `UseXShell()`; supply a non-empty rooted request path, normally a dedicated resource namespace such as `/_resources/DProjects.XShell`. |
| `Resources.ResourceName` | `"DProjects.XShell"`; selects the physical resource directory under `Resources/` in the XShell project (Development) or assembly output directory (other environments). It does not set a URL prefix. |
| `XShell.BasePath` | `""` is a placeholder rejected by `UseXShell()`; supply a rooted bootstrap and worker source base. |
| `Server.Environment` | `null`; use ASP.NET's environment name. An explicit value overrides XShell's own environment and development resource behavior. |
| `Server.ContentSecurityPolicy` | Same-origin default policy, data images allowed, objects disabled; emitted as an HTML CSP meta element. |
| `Server.UnhandledPrefixes` | `["/_", "/api", "/temp"]`; unmatched relative paths with these prefixes bypass SPA fallback. |
| `Temp.Path` | `""` is a placeholder rejected by `UseXShell()`; supply a nonempty physical temporary-file storage root. |
| `Temp.BasePath` | `/temp`; independent public Temp prefix. |
| `Temp.ExpirationTime` | One hour. |
| `Temp.FileSizeLimit` | `104857600` bytes (100 MiB); maximum accepted upload size. |

The default `Server.ContentSecurityPolicy` text is (the implementation includes a trailing space after the last semicolon):

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self';
```

`UseXShell()` rejects invalid static host settings before resource lookup, middleware registration, or bootstrap generation. It requires positive Temp limits,
rooted request paths for `Resources.BasePath`, `Temp.BasePath`, `XShell.BasePath`, and each `Server.UnhandledPrefixes` entry. Only
`App.BasePath` may be empty; nonempty values must be rooted. Temp directory creation remains in `TempMiddleware`.
`Resources.BasePath`, `XShell.BasePath`, and `Temp.BasePath` are independent, not automatically rebased by `App.BasePath`.
The bundled `server` command explicitly derives `Resources.BasePath` as `<AppBasePath>/_resources/<ResourcesName>`.
Set browser runtime paths consistently when changing resource routing.
The host URL-encodes each `App.Params` key and value, joins them as query text, and HTML-encodes the resulting meta attribute value.
Generated host HTML attribute values are HTML encoded. This serialization safety does not replace semantic host configuration validation.

## Request pipeline

1. Resource middleware serves the physical resource tree.
2. Temp middleware handles its prefix.
3. A request exactly at `App.BasePath` redirects to `App.BasePath + "/"`. With a nonempty application base, requests outside it also redirect there unless resource or Temp middleware handled them first.
4. `UseRouting()` selects registered endpoints.
5. For GET and HEAD, generated `index.html` and `sw.js` at the application base are returned before matched endpoints; other already-matched endpoints continue through the pipeline.
6. Unmatched GET and HEAD requests inside the base with an unhandled relative prefix continue through the pipeline.
7. Other unmatched GET and HEAD requests inside the base receive the generated host HTML as SPA fallback.

Unhandled matching is case-insensitive textual prefix matching: `/apiary` also matches `/api`.
Generated files and SPA fallback handle only GET and HEAD. HEAD returns the same representation status, Content-Type, and Content-Length as GET without a body. Other methods continue through the ASP.NET pipeline, including to registered endpoints. Path navigation uses SPA fallback for friendly-URL reloads.

`BootstrapFilesBuilder` emits HTML, CSP meta, `xshell:` startup meta, and the bootstrap script.
Generated `sw.js` imports the configured worker source. Bootstrap registers it with the application base-path scope
`App.BasePath + "/"` (root scope only when `App.BasePath` is empty).
These `App` settings are host inputs, not authored application metadata. Bootstrap derives effective `config.app` from the selected root module
and the host values. `pack` uses the same builder to put `index.html` and root `sw.js` inside the selected root module's immutable generation.
Deployment can alias stable application and worker URLs to those files using `release.root`; the packer does not create the aliases.

A deployed immutable framework generation directory, such as `/xshell/<version>.<hash>`, can serve as `XShell.BasePath`. Its published directory
directly exposes `bootstrap.js`, `xshell.json`, and `sw.js` for startup requests. The same scripts also remain inside the complete `xshell.zip`.

## Browser platform requirement

XShell V0 requires a secure context because the browser runtime uses platform
capabilities such as Service Workers. Production hosting must use HTTPS;
trusted local origins such as `localhost` may use the browser's normal
development exception. See [Browser Platform Baseline](15-browser-platform.md)
for the Baseline 2026 compatibility contract and the absence of legacy-browser
compatibility, polyfills, and downlevel builds.

## Resources and development

XShell uses `Server.Environment` when nonempty, otherwise ASP.NET's environment name. A case-insensitive `Development`
value enables XShell development resources; an explicit `Production` disables them even if the ASP.NET host is Development. This does not modify
ASP.NET's own environment object.
Development uses assembly `ProjectDirectory` metadata to locate `<project>/Resources/<Resources.ResourceName>`; other environments use
`<assembly output directory>/Resources/<Resources.ResourceName>`.
The resource directory must exist.

Development middleware disables caching, serves generated module and XShell descriptor responses with current physical inventories embedded at
`modules.<localId>.files` or `xshell.files`, and compiles normal-module JS/HTML/CSS on demand. It discovers exactly one JSON or JSONC source for
either requested descriptor extension, emits strict `application/json`, and does not modify the authored descriptor. Generated `files` replaces
any stale authored value.
Logical `.js` requests may compile an HTML SFC; direct source `.html` requests return 404. Same-basename HTML/JS conflicts fail compilation.
Development inventories contain physical source paths, possibly authored `.html`, while excluding descriptor files; packed inventories contain
generated `.js`. Inventory paths remain package-relative until bootstrap normalizes the descriptor.
Debugger presence does not select this behavior.

## Server command

The bundled `server` command hosts resources and the demo. Options include `-a` / `--app-base-path` (app base path),
`-c` / `--app-config-path` (app config file path), `-e` / `--environment` (XShell environment), repeatable `-p` / `--param`
(params), and `-r` / `--resources-name`. The resource name defaults to
`DProjects.XShell` and selects the logical directory `Resources/<name>/`. For `ResourcesName = "Custom"` and `AppBasePath = "/demo"`, server uses
`Resources.ResourceName = "Custom"`, `Resources.BasePath = "/demo/_resources/Custom"`, `XShell.BasePath = "/demo/_resources/Custom/xshell"`, and
the default `App.ConfigPath = "/demo/_resources/Custom/x-demo/module.jsonc"`. An explicit `--app-config-path` is preserved unchanged.
`ResourcesName` selects bundled source content. The command separately derives the HTTP resource request path and XShell bootstrap/worker
source path from that name. It is not a module id, package id, or runtime assets namespace. The default
application is x-demo; server supplies no application authentication pipeline. Select `Development` for on-demand compilation.

See [Bootstrap](10-bootstrap.md), [Navigation](120-navigation.md), [Packaging](50-packaging.md), [Service Worker](110-service-worker.md), and [Temp](../30-subsystems/50-temp.md).
