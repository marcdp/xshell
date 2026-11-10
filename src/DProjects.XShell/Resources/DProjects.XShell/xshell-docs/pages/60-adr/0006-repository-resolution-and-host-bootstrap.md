# ADR-0006: Repository Resolution and Host-Owned Bootstrap

## Status

Implemented for development hosting and browser startup. Production application packaging integration is incomplete.

## Context

The previous browser bootstrap loaded a framework `bootstrap.js`, started from a root manifest URL, and recursively discovered module documents from
authored `modules.<id>.configUrl` entries. That coupled package discovery to configuration composition and made the selected framework generation
responsible for host startup.

The current host needs ordered repository precedence, version selection before manifest download, dependency metadata independent of manifest
composition, and one stable startup pipeline that can select the XShell runtime like any other module generation.

## Decision

The host owns browser bootstrap through `bootstrap/index.js` and supplies:

- a root `module:<id>:<requirement>` reference;
- an application base path and parameters;
- an application environment;
- ordered repository index URLs; and
- the Temp service URL.

Repository indexes locate module version indexes. Version entries locate immutable or development manifests and declare direct dependencies.
Bootstrap recursively resolves those version-index references, selects the highest compatible stable generation from the first suitable repository,
downloads selected manifests, rejects conflicting generations and cycles, and merges framework and module configuration dependency-first with the
root last.

The selected root module is the entry point for dependency resolution. The application is the composition of the root, dependencies, selected
framework, and host values. Bootstrap creates `config.app` as effective application metadata and hosting context; it does not rename the root module
or replace the complete effective configuration.

Downloaded manifests do not introduce packages through authored `configUrl` entries. `configUrl` remains valid generated metadata identifying each
selected manifest. `assets.url` remains the physical resource-container URL, and generated `assets.path` remains the virtual generation namespace.

The host generates resolver rules and Service Worker mappings, imports the selected framework runtime entry, deep-freezes the effective
configuration, and calls `xshell.init(config)`. There is no version-specific bootstrap script and no separate pre-init validation call.

## Version contract

The browser supports exact stable `major.minor.patch`, `latest`, and fully specified caret and tilde requirements. It does not support `*`, shortened
ranges, prerelease selection, build-metadata selection, or general npm SemVer expressions. Repository/index builders may accept a wider manifest
version syntax; index production and browser selectability are intentionally documented separately.

## Consequences

Repository order is an application host policy. Unavailable sources can be skipped when later sources satisfy resolution, while the normalized
configured source list remains visible in `config.app.sources`. The module version index is part of the resolution contract and must contain direct
dependencies.

The virtual resource namespace remains `/_assets`. The current host sets it explicitly. The Service Worker registry can retain multiple selected
generations without changing effective application configuration.

Development middleware implements repository and version indexes on demand. Production application packaging must eventually produce or reference
equivalent repository metadata and host startup files. Current `Pack.cs` still follows `configUrl` references, expects framework `bootstrap.js`, and
does not implement root startup generation; it must not be documented as completing this decision.

## Related documentation

- [Bootstrap](../10-architecture/10-bootstrap.md)
- [Configuration](../10-architecture/20-configuration.md)
- [Modules](../10-architecture/30-modules.md)
- [Hosting](../10-architecture/40-hosting.md)
- [Packaging](../10-architecture/50-packaging.md)
