# Architecture

XShell starts from a host-selected root module reference and resolves it through ordered repositories. The flow is:

```text
HTML/bootstrap inputs → repository indexes → module version indexes → selected root and recursive dependencies
    → manifests → URL and embedded-inventory normalization → nested effective configuration (app, modules, xshell)
    → Service Worker mappings → resolver rules from file inventories (including service contracts)
    → import XShell → deep freeze → init and validate effective config
    → initialize i18n and Contracts → register core services → finalize service registry → validate module service requirements → one live module instance per module id
    → controllers register runtime sources → Areas compose menus, routes, and homes → Navigation starts
```

`config.app` contains effective application metadata and hosting context. `config.modules` contains selected definitions keyed by module id, and
`config.xshell` contains framework configuration. The root module is the dependency-resolution entry point, not the whole application. Dependency
requirements come from module version indexes, not authored `configUrl` references in downloaded manifests. Bootstrap merges dependencies before
dependents and the root last; cycles and conflicting generations are rejected. `xshell.modules` is the runtime service and creates one live module
instance per effective id. See [Bootstrap](10-bootstrap.md).

Module resources use the host-fixed effective namespace `/_assets/<module>/<generation>/...`. The framework manifest currently authors
`xshell.assets.basePath` as `app:/_assets`, but the host explicitly initializes the effective base. The Service Worker maps that namespace to source
files or ZIP packages. Resource resolution selects a URL and loader; the loader obtains the resource. A Page uses the normal Component model plus Navigation.
Module defaults define the render and state engines for their own definition-based Pages and Components. XShell defaults are separate global UI
infrastructure for layout contexts, lazy/error/Markdown components, and standard dialog pages.

For a definition-based Component or Page, its loader is the orchestrator: it owns the contract, properties, public API, controller, lifecycle,
services, and coordination. The state engine owns reactive state only; the render engine owns rendered output only. See [Loaders](90-loaders.md) and
[Component Lifecycle](../20-components/60-lifecycle.md).

When a definition declares `dependencies`, its loading flow is:

```text
component or Page definition
    ↓
read dependencies
    ↓
Resolver maps each reference
    ↓
Loader obtains each resource
    ↓
create controller with controller({ dependencies })
```

An Area is a navigation context composed from participating modules, including their effective menus and ordered routes. Modules define reusable menu
and route contributions; Areas define application composition. Home uses the depth-first default-item result, falling back to the first depth-first
`path || href` target.
There is no separate visibility predicate in that fallback. This composition does not duplicate module instances. Navigation consumes Area routes for
public-to-canonical and
canonical-to-public resolution. A named menu contribution can be a static array or a registered dynamic menu source; see
[Areas](../30-subsystems/10-areas.md) for composition behavior and [Navigation](120-navigation.md) for route resolution.

## Inspection registries

`registry` is the standard read-only inspection property for XShell subsystems that own or track a collection of runtime or registered entries.
It is observational, side-effect free, and normally returns a frozen snapshot. Services, Modules, Contracts, Resolver, and Loader expose metadata
appropriate to their domains; reading a registry never creates, resolves, or loads an entry. Re-read the property after relevant Bus events to see
current state. Operational APIs such as `services.resolve(...)` and `loader.load(...)` remain separate.

## Documents

- [Bootstrap](10-bootstrap.md) — Startup and preparation versus runtime initialization.
- [Browser Platform Baseline](15-browser-platform.md) — Baseline 2026 and the secure-context requirement.
- [Configuration](20-configuration.md) — Nested effective configuration and merge rules.
- [Modules](30-modules.md) — Definitions, references, root composition, params, and live instances.
- [Hosting](40-hosting.md) — ASP.NET middleware, generated bootstrap, and SPA fallback.
- [Packaging](50-packaging.md) — Implemented packaging mechanisms and the incomplete legacy application-pack integration.
- [Components](60-components.md) — The Web Component model.
- [Pages](70-pages.md) — Pages and layouts.
- [Resolvers](80-resolvers.md) — Logical resource resolution.
- [Loaders](90-loaders.md) — Resource loading.
- [DataSets](95-datasets.md) — Static, URL, and module-owned tabular JSON resources.
- [Services](100-services.md) — Contracts, configured implementations, immutable registry topology, and lazy singleton resolution.
- [Service Worker](110-service-worker.md) — Resource virtualization.
- [Navigation](120-navigation.md) — Hash and path navigation plus Area context.

## Related documentation

- [Specifications](../50-specifications/)
- [Subsystems](../30-subsystems/)
- [Asset URL Namespace](../60-adr/0001-asset-url-namespace.md)
- [Areas](../30-subsystems/10-areas.md)
