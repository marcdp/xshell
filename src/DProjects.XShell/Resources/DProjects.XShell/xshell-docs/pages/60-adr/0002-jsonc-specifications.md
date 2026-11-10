# ADR-0002: JSONC Specifications

## Status

Accepted for JSONC authoring and effective-configuration schema validation. Its original `configUrl` composition mechanism is superseded for active
browser bootstrap by [ADR-0006](0006-repository-resolution-and-host-bootstrap.md).

## Context

XShell's human-authored configuration benefits from comments. Earlier checked-in application and module files used flat dotted keys and a separate
`app.jsonc` convention. Later bootstrap code used one local `modules.<id>` definition plus external `configUrl` references. Neither legacy form is
the current browser discovery model.

## Decision retained

Use JSONC for human-authored module and framework manifests. Compose nested `app`, `modules`, and `xshell` objects into one effective configuration.
Merge plain objects recursively, concatenate arrays, and let later scalar values replace earlier ones. Dependencies precede their dependents, with
the root last.

Use JSON Schema as the validation language for the complete effective configuration. Authored manifests may be partial contributors; bootstrap
enriches selected definitions with generated locations, inventories, host application metadata, Service Worker mappings, and resolver entries.
Deeply freeze the result before handing it to XShell.

## Superseded discovery decision

The earlier browser design identified a document's local definition as the `modules.<id>` object without `configUrl` and recursively followed other
`modules.<id>.configUrl` entries. The active browser instead selects manifests through repository and module version indexes. Version-index
dependency entries drive recursive discovery; downloaded manifests contribute configuration but do not introduce new packages through
`configUrl`.

The selected root remains a module definition. The application is the broader composition of the root, dependencies, selected framework, and host
configuration; generated `config.app` is its metadata and hosting projection.

## Consequences and current status

Development middleware accepts authored JSON or JSONC and serves selected `/manifest.json` URLs as strict JSON with generated inventories. The
host-owned bootstrap rejects conflicting generations and dependency cycles, merges in deterministic dependency-first order, generates mappings and
resolver entries, freezes the effective object, and calls `xshell.init(config)`. Initialization performs schema validation before constructing the
remaining runtime subsystems.

The canonical schema is `xshell/schemas/config.schema.json`. It defines module defaults for definition-based Page and Component engines, global
XShell UI infrastructure, Areas, navigation, resolvers, services, i18n, asset locations, generated inventories, and application metadata.

The current Pack command still implements the superseded `configUrl` graph internally and has incomplete root startup integration. That packaging
code does not restore the old mechanism as the active browser architecture.

See [Configuration](../10-architecture/20-configuration.md), [Specifications](../50-specifications/), and
[ADR-0006](0006-repository-resolution-and-host-bootstrap.md).
