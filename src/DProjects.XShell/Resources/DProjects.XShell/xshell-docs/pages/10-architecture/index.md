# Architecture

XShell starts from a host-selected root module reference, resolves a stable module graph through ordered repository indexes, normalizes selected
descriptors and file inventories, and composes one effective `app`, `modules`, and `xshell` configuration. The root module is the resolution entry
point, not the complete application. Dependencies merge before dependents and the root merges last.

The host fixes the effective virtual asset namespace at `/_assets`. Service Worker mappings connect generation-qualified virtual paths to expanded
resources or supported ZIP packages. Resolvers interpret logical resource references and select URLs/loaders; loaders obtain or construct resources.
At runtime, one module instance exists per effective module id.

Definition-based Components and Pages keep an inline public contract distinct from implementation. Their loaders orchestrate properties, controllers,
lifecycle, dependencies, and engine selection. State engines own reactive state and render engines own output. Module engine defaults are distinct
from global `xshell.ui` infrastructure.

Areas compose reusable module menus and routes into navigation contexts without creating more module instances. Navigation translates friendly
routes separately from canonical Page/resource hrefs.

## Inspection registries

Subsystems that own collections expose read-only `registry` snapshots for observation. Reading a registry does not create, resolve, or load an item;
operational APIs such as `services.resolve(...)` and `loader.load(...)` remain separate.

## Documents

- [Bootstrap](10-bootstrap.md) — Repository resolution, startup, validation, and initialization order.
- [Browser Platform Baseline](15-browser-platform.md) — Baseline 2026 and secure-context requirements.
- [Configuration](20-configuration.md) — Effective configuration and merge rules.
- [Modules](30-modules.md) — Definitions, references, root composition, params, and live instances.
- [Hosting](40-hosting.md) — ASP.NET middleware, generated bootstrap, and SPA fallback.
- [Packaging](50-packaging.md) — Reusable packaging and the incomplete legacy application-pack integration.
- [Components](60-components.md) — Web Component architecture and loader ownership.
- [Pages](70-pages.md) — Component-based presentation plus Page navigation context.
- [Resolvers](80-resolvers.md) — Logical resource interpretation.
- [Loaders](90-loaders.md) — Resource acquisition and construction.
- [DataSets](95-datasets.md) — Static, URL, and module-owned tabular JSON resources.
- [Services](100-services.md) — Contracts, registration, and lazy singleton resolution.
- [Service Worker](110-service-worker.md) — Virtual resource mappings and ZIP consumption.
- [Navigation](120-navigation.md) — Hash/path navigation, routes, and Area context.

## Related documentation

- [Component guides](../20-components/)
- [Subsystems](../30-subsystems/)
- [Specifications](../50-specifications/)
- [Architecture Decision Records](../60-adr/)
