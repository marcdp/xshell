# Specifications

XShell authors configuration as JSONC. The root module uses the same `manifest.jsonc` model as other modules; there is no separate authored
application format. All descriptors use `manifest.json` or `manifest.jsonc`. A descriptor directly inside `xshell/` is an XShell framework
descriptor; a descriptor in every other directory is a module descriptor. Its extension selects the parser, and classification selects the
framework or module structure. See [Root Module and Application Metadata](application.md) for the generated `app` section and [Module](module.md)
for local definitions, repository dependency references, and asset locations.
The root also composes [Areas](../30-subsystems/10-areas.md) from module ids. Module menu contributions remain independent of that placement.

The validation boundary is the complete effective configuration after repository resolution, descriptor and embedded-inventory normalization,
merge, worker mapping, and resolver generation. Host bootstrap imports XShell, deep-freezes the object, and calls `xshell.init(config)`.
Initialization creates Resolver and Loader and then validates against `xshell/schemas/config.schema.json` before constructing the remaining runtime
services. There is no separate host-side `xshell.validateConfig(config)` call.
The X module currently includes a `module.js` controller; configuration validation remains a separate bootstrap and initialization responsibility.

The schema defines `app`, `modules`, and `xshell`, including module `configUrl`, nested `assets`, defaults, menus, optional service `requires`, optional
declarative routes, named `xshell.services`, and the required `xshell.i18n` language, formatting,
and translation configuration.

Every resolved module requires **module defaults** at `modules.<id>.defaults`: both `page` and `component` require non-empty render-engine and
state-engine names. These select how the owning module's definition-based resources execute after a resource `meta` override. The separate
**XShell defaults** object, `xshell.ui`, requires `layout`, `component`, and `dialog` groups for global UI infrastructure: layout contexts,
lazy/error/Markdown components, and standard dialog pages. It does not provide render or state engines for modules.

See [Configuration](../10-architecture/20-configuration.md) and [ADR-0002](../60-adr/0002-jsonc-specifications.md).

## Public contract schemas

[Component Contract](../20-components/10-manifest.md) describes the shared `contract.schema.json` architecture and its Component/Page specializations.
[Services](../10-architecture/100-services.md) describes `service.schema.json` and service contract registration.
[Component Architecture](../10-architecture/60-components.md) describes the inline contract and implementation checked by `component.schema.json`.
[Pages](../10-architecture/70-pages.md) describes the inline Page contract checked by `page.schema.json`.
[Module](module.md#public-contracts) describes why Module configurations have no public contract.
[DataSet JSON](dataset.md) describes the tabular object shape in `dataset.schema.json` and its current runtime validation boundary.
