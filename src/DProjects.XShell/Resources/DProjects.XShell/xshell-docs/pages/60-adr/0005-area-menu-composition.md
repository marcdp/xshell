# ADR-0005: Area and Menu Composition

## Status

Implemented for hash and path navigation. This revision supersedes the original module-owned menu composition.

## Context

Applications reuse menu definitions across navigation contexts and combine menu content from several manifests. Routes still follow the modules
that participate in each Area.

## Decision

Modules contribute service configuration through `xshell.services.<service-name>.options`. Bootstrap normalizes each manifest's resource URLs,
then recursively merges objects and identified array elements in framework, dependency, and root order. Matching items retain their positions.
Bootstrap applies the same rules to all configuration sections.

Menus is a declarative singleton. Its options own named application menu definitions. Areas maps logical slots to those names and composes routes
from participating modules. An Area-scoped menu can be selected by several Areas. Menus applies each Area's prefix to its own read-only
projection. Global menus are static and application-wide. Canonical asset paths identify the resources and their runtime modules.

## Consequences and open work

XShell resolves Areas and Menus before initializing module controllers. The Menus constructor validates Area selections and publishes globals.
Module controllers can register sources during initialization. XShell then initializes the contextual menus and derives Area routes and homes
before Navigation starts. Menu shortcuts initialize after Navigation.

Navigation uses menu aliases and canonical Area-aware hrefs. Page loading removes the matched Area prefix for resource lookup. Menus emits
`xshell:menus:change` for effective source updates. Areas emits `xshell:area:change` when navigation changes the active Area.

See [Areas](../30-subsystems/10-areas.md), [Navigation](../10-architecture/120-navigation.md), and [Configuration](../10-architecture/20-configuration.md).
