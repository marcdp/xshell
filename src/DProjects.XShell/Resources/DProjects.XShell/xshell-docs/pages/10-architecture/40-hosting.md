# ASP.NET Hosting

`app.UseXShell(configuration)` installs resource, Temp, and share middleware, generated startup files, and the SPA fallback.

```csharp
using DProjects.XShell;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.UseXShell(new Extensions.Configuration {
    App = new Extensions.AppConfig {
        BasePath = "/prefix",
        Module = "module:x-demo:0.9.0"
    },
    Sources = ["/prefix/_resources/DProjects.XShell/{module}/index.json"],
    Temp = new Extensions.TempConfig {
        Path = Path.Combine(Path.GetTempPath(), "DProjects.XShell", "temp"),
        BasePath = "/prefix/temp"
    }
});
app.Run();
```

`App.BasePath` is empty for root hosting or a rooted path without a trailing slash. `UseXShell()` registers the built-in resource tree at
`<App.BasePath>/_resources/DProjects.XShell`. `Sources` is an ordered list of package-index URL templates. The host preserves these values,
including external URLs; it does not prepend the application base to them. A local source must name the actual route, as in the example.
The bundled `server` command supplies `<App.BasePath>/_resources/DProjects.XShell/{module}/index.json` when no source is specified.
Explicit `--source` values keep their order and spelling.

The generated `index.html` includes the application module, base path, parameters, environment, Temp URL, and one `xshell:source` meta tag
per source. It loads `<App.BasePath>/index.js`. That small ESM entry point locates the root module, reads its direct `xshell` dependency,
and dynamically imports the selected framework's `bootstrap.js`. It accepts an exact `major.minor.patch` version or `*` in these initial
module references. For `*`, it chooses the highest stable semantic version with a hash in the first suitable source. Other version
expressions are not supported by this initial locator. The browser framework handles further module dependency resolution.

In Development, a module's `index.json` is generated from its local `manifest.json` or `manifest.jsonc` on GET and HEAD. The index contains
the authored version, hash `dev`, a relative manifest `url` of `<version>.dev/manifest.json`, and direct dependencies. A URL of the form
`<App.BasePath>/_resources/DProjects.XShell/<module>/<version>.dev/<resource>` maps to the same physical file as the unversioned URL,
provided the version matches the local manifest. The normal descriptor, compiler, and static-file handlers serve the mapped resource.
Published indexes may instead use an absolute HTTP(S) manifest `url`; module package files are then resolved relative to that manifest.
Development descriptors include current physical file inventories; symbolic links are omitted from those inventories. Development
requests reject traversal and links that would leave the configured resource root. Production does not generate package indexes or
translate `.dev` paths.

The generated `index.html`, `index.js`, and `sw.js` respond to GET and HEAD at the application base. HEAD has the same representation
headers as GET and no body. Other methods continue through the ASP.NET pipeline. A request exactly at a nonempty `App.BasePath`
redirects to its trailing-slash form. Unmatched GET and HEAD routes inside that base receive `index.html` unless a configured
`Server.UnhandledPrefixes` entry matches. Registered endpoints still handle requests that the generated routes do not claim.

`Server.Environment` overrides the ASP.NET environment for XShell when nonempty. The built-in physical resource directory is selected
from the project directory in Development and from the assembly output in other environments. `Temp.Path` must be a nonempty physical
path. `Temp.BasePath` is configured independently. `Server.ContentSecurityPolicy` is emitted as an HTML CSP meta element.

See [Bootstrap](10-bootstrap.md), [Packaging](50-packaging.md), [Service Worker](110-service-worker.md), and [Temp](../30-subsystems/50-temp.md).
