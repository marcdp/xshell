# ASP.NET Hosting

`app.UseXShell(configuration)` installs development resources, Temp and share middleware, generated startup files, and the SPA fallback.

```csharp
using DProjects.XShell;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.UseXShell(new Extensions.Configuration {
    App = new Extensions.AppConfig {
        BasePath = "/prefix",
        Module = "module:x-demo:latest",
        Sources = ["/prefix/_resources/DProjects.XShell/index.json"]
    },
    Temp = new Extensions.TempConfig {
        Path = Path.Combine(Path.GetTempPath(), "DProjects.XShell", "temp"),
        BasePath = "/prefix/temp"
    }
});
app.Run();
```

`App.BasePath` is empty for root hosting or a rooted request path without a trailing slash. `App.Module` is the root module reference.
`App.Sources` is an ordered list of repository index URLs, exposed through repeatable `xshell:app.source` elements. A local development repository
index is served at `<App.BasePath>/_resources/DProjects.XShell/index.json`; module indexes are below it at `<module-id>/index.json`.

## Generated startup files

`BootstrapFilesBuilder` reads every file under the bundled `bootstrap/` directory. It substitutes host values only in `index.html`, and the host
serves the generated set at the application base. The checked-in set is:

- `index.html`, containing application module, base path, parameters, environment, repository sources, Temp URL, CSP, and the module script;
- `index.js`, containing the complete repository-driven browser bootstrap; and
- `sw.js`, the application Service Worker.

The generated HTML uses these current interfaces:

```html
<meta name="xshell:app.module" content="module:x-demo:latest">
<meta name="xshell:app.basePath" content="/prefix">
<meta name="xshell:app.params" content="tenant=acme">
<meta name="xshell:app.environment" content="Development">
<meta name="xshell:app.source" content="/prefix/_resources/DProjects.XShell/index.json">
<meta name="xshell:xshell.temp.url" content="/prefix/temp">
<script type="module" src="/prefix/index.js"></script>
```

There is one `xshell:app.source` element per configured source. The current host does not use `xshell:source`,
`xshell:app.configPath`, or `xshell:xshell.environment`.

`index.js` owns the complete startup pipeline. It resolves the root and dependencies, downloads manifests, merges effective configuration,
registers mappings, imports the selected runtime, freezes the configuration, and calls `xshell.init(config)`. It does not import a framework
`bootstrap.js`.

## Development repository endpoints

In Development, `ResourcesMiddleware` generates:

- the repository catalog at `/_resources/DProjects.XShell/index.json`;
- each module's version index at `/_resources/DProjects.XShell/<module-id>/index.json`;
- strict-JSON `manifest.json` or `manifest.jsonc` responses enriched with generated file inventories; and
- versioned resource URLs under `<module-id>/<version>.dev/...`, translated to the current physical module directory.

The repository index contains relative module-index URLs. A version index contains the local manifest version, a relative
`<version>.dev/manifest.json` URL, and direct dependencies copied from the local definition. The browser always requests selected manifest URLs
ending in `/manifest.json`; middleware may generate that response from an authored JSONC file.

Development requests reject traversal, ambiguous `manifest.json`/`manifest.jsonc` sources, version mismatches, and links that escape the configured
resource root. Production resource middleware does not generate indexes or translate `.dev` generation paths.

## Request routing

Generated startup files answer GET and HEAD at the application base. HEAD has the same representation headers and no body. A request exactly at a
nonempty `App.BasePath` redirects to the trailing-slash form. Unmatched GET and HEAD requests inside the base receive `index.html` unless a registered
endpoint handles them or the remaining path starts with a configured `Server.UnhandledPrefixes` entry.

`Server.Environment` overrides the ASP.NET environment when nonempty. It becomes `xshell:app.environment` and later
`config.app.environment`. Development resources come from the project directory; other environments use resources beside the assembly.
`Server.ContentSecurityPolicy` becomes the HTML CSP meta value.

## Known server-command inconsistency

`Extensions.AppConfig.Sources` and the active bootstrap expect repository index URLs. The `server` command still defaults to
`<AppBasePath>/_resources/DProjects.XShell/{module}/index.json`, an obsolete module-template form. With no explicit `--app-source`, braces are
URL-encoded and the repository request does not address the generated repository catalog. Until the command is fixed, pass:

```text
--app-source /prefix/_resources/DProjects.XShell/index.json
```

Use `/_resources/DProjects.XShell/index.json` when the application base is empty.

See [Bootstrap](10-bootstrap.md), [Packaging](50-packaging.md), [Service Worker](110-service-worker.md), and [Temp](../30-subsystems/50-temp.md).
