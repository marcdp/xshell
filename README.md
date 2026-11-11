# XShell

XShell is a pre-1.0, browser-native runtime for modular enterprise web applications. It builds on ES modules, Web Components, Service Workers, URLs,
CSS, `fetch`, and ASP.NET Core development hosting. Its main concepts are Modules, resources, Contracts, Pages, Services, Areas, and Navigation.

An application is composed from a host-selected root module, its recursively resolved dependencies, the selected XShell framework, and host values.
The root module starts dependency resolution; it is not the complete application. Browser bootstrap resolves repository indexes, normalizes module
descriptors, creates Service Worker mappings for the fixed `/_assets` virtual namespace, and initializes one effective configuration.

Important boundaries are deliberately explicit:

```text
Resolver       -> interprets a logical resource and selects its URL and loader
Loader         -> obtains or constructs the concrete resource
Contract       -> describes public API
Implementation -> provides behavior
Property       -> public API
State          -> private reactive data
State engine   -> owns reactive state
Render engine  -> owns rendered output
Module         -> reusable package
Area           -> navigation context composed from module contributions
```

Components may be native custom-element classes or definition objects. Definition-based Components and Pages declare an optional public `contract`
inline in the default-exported implementation object. Pages reuse the Component model and add navigation context and Page lifecycle.

## Prerequisites and repository layout

- .NET SDK `10.0.400` with the latest patch in that feature band, as selected by [`global.json`](global.json).
- Node.js 24 or newer for the client-runtime tests.
- A sibling checkout of `marcdp/libs`, because the XShell project references projects under `../libs/src/`.

The expected layout is:

```text
parent/
├── libs/
│   └── src/DProjects.*/
└── xshell/
    ├── src/DProjects.XShell/
    ├── test/DProjects.XShell.Test/
    └── test/DProjects.XShell.Client.Test/
```

No npm install is required for the current client test package; it uses Node's built-in test runner and has no package dependencies.

## Start the development server

From the `xshell` repository root:

```bash
dotnet run --project src/DProjects.XShell -- server --app-module module:x-demo:0.9.0 --app-source /_resources/DProjects.XShell/index.json --environment Development
```

The command starts the ASP.NET development host with the checked-in `x-demo` root and repository index. Use the URL reported by ASP.NET. The cookbook
file explorer uses the in-memory filesystem and needs no hosted share. `Properties/launchSettings.json` also contains an `x-demo` profile, but its
optional sample share path is machine-specific; omit or replace that share when using the profile elsewhere.

## Build and test

Restore and build the solution:

```bash
dotnet restore XShell.slnx
dotnet build XShell.slnx --configuration Release --no-restore
```

Run the .NET tests:

```bash
dotnet test --solution XShell.slnx --configuration Release --no-build --no-restore --
```

Run all client-runtime tests, including the documentation checks:

```bash
cd test/DProjects.XShell.Client.Test
npm test
```

The active GitHub Actions coverage is intentionally limited. `.github/workflows/xvault-interop.yml` runs the XVault Node/Python interoperability
tests. `.github/workflows/ci.yml.old` is inactive and must not be treated as repository build, .NET test, client-suite, or packaging coverage.

## Current implementation limitations

- Full application packaging is not aligned with the active repository-driven bootstrap. `Pack.cs` still follows legacy `configUrl` discovery,
  expects framework `bootstrap.js` startup files, and does not implement root startup-file generation.
- Service Worker consumption of expanded directories and supported immutable ZIP destinations is implemented, but that is separate from producing a
  complete repository-driven application distribution.
- Authentication and Identity are available through the optional `x-identity` module; they are not XShell Core subsystems.
- Declarative navigation intent mapping and dispatch remain outside V0.
- XShell targets Baseline 2026 Web Platform capabilities and secure contexts; it does not provide legacy-browser polyfills or downlevel builds.

## Documentation

Canonical documentation is runtime content under
[`src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/`](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/index.md):

- [Architecture](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/10-architecture/index.md)
- [Components](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/20-components/index.md)
- [Subsystems](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/30-subsystems/index.md)
- [Extensions](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/40-extensions/index.md)
- [Specifications](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/50-specifications/index.md)
- [Architecture Decision Records](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/60-adr/index.md)

For repository-specific contribution guidance, see [`AGENTS.md`](AGENTS.md).
