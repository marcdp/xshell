# Areas

An Area is a navigation context composed from participating modules, including the effective menus and route declarations contributed by those
modules. Modules own declarative metadata; Areas define application composition. A module may participate in several Areas or none, while Modules
keeps one live runtime instance per canonical module id. Navigation remains responsible for browser URLs, history, page stacks, and page activation.

## Configuration and ownership

This composition fragment omits module metadata/defaults and other effective configuration sections:

```jsonc
{
    "modules": {
        "reports": {
            "menus": {
                "navigation": {
                    "label": "Reports",
                    "items": [{ "label": "Reports", "path": "reports", "href": "/pages/report.js", "default": true }]
                },
                "tools": { "items": [{ "label": "Export", "href": "/pages/export.js" }] },
                "shortcuts": { "scope": "global", "items": [{ "label": "About", "href": "/pages/about.js" }] }
            }
        }
    },
    "xshell": {
        "services": {
            "areas": {
                "options": {
                    "default": "customers",
                    "definitions": {
                        "customers": { "prefix": "customers", "label": "Customers", "modules": ["reports"] },
                        "inventory": { "prefix": "inventory", "label": "Inventory", "modules": ["reports"] }
                    }
                }
            }
        }
    }
}
```

Each `xshell.services.areas.options.definitions.<id>` entry may set `prefix`, `label`, `icon`, `modules`, `order`, and descriptive `description`.
The `modules` array
sets participation
and menu contribution order. The effective schema rejects a configured Area `home`; runtime derives it from menus. Root ownership is an architectural convention: bootstrap can merge
`xshell` fragments from imported configurations. Arrays, including `area.modules`, concatenate during that merge.
Authored navigation prefixes and friendly menu paths conventionally omit the leading `/`; a leading `/` is XShell's module-root-relative
configuration syntax. Areas normalizes the ordinary authored values into leading-slash navigation paths at runtime.

Areas are presented with the configured default first, then by `order`, then `label`. An unknown configured default or duplicate normalized
prefix throws. With no configured default, the first sorted Area is used. The initial current Area is the default Area.

## Menus and home

Each entry in a module's `menus` dictionary is a definition keyed by its menu name. A contribution can supply `scope`, `label`, `description`,
`icon`, static root `items`, and a `source` for Area menus.

Areas resolves scope by menu name across all selected modules. An explicit `"global"` or `"area"` applies to every contribution with that name,
including contributions that omit the field. If every contribution omits `scope`, the effective scope is `"area"`. Conflicting explicit values
raise a configuration error identifying the menu and the modules that declared them.

Each Area composes Area-scoped menus from its participating modules in `area.modules` order. Later supplied metadata overrides earlier values,
including `icon: null`. Omitted fields preserve earlier values, and metadata-only contributions retain earlier items.

For each module, Areas merges its explicit `items` and then the items from its `source`. A source beginning with `/` is a module-relative inventory
path. Other source strings identify registered sources whose `resolve()` method returns menu items. All contributing modules' sources participate
in order. Module controllers register runtime sources before `Areas.init()`, which fails if a menu source or `childrenSource` is unregistered.
Each effective Area item carries its module id, Area id, label, icon, children, optional friendly `path`, and canonical `href`.

Menu items can declare an optional `id`. Areas recursively merges items with the same non-empty string ID within each named menu or parent's
`children` array. The first occurrence sets the item's position in the merged array. Later explicitly supplied properties override earlier values,
and omitted properties retain earlier values. Child arrays follow the same rules. Items with different, missing, or empty IDs append in contribution order.
An identified contribution may omit `label` when another contribution supplies it. An identified group with children and no target or command
can use an empty label by default. An item with an `href` keeps the module ownership of that target until a contribution overrides it.

Each Area menu, global menu, and nested `children` array has a shared opening block at `0`. A later contribution's leading items without
`order` append to that block in composition order. An explicit numeric `order` starts a block for that item and the siblings that follow it in
the same contribution, up to the next explicit `order`. After merging by ID, Areas sorts whole blocks by their starting values. The opening
block precedes explicit blocks at `0`, and other ties retain composition order. Effective item orders increment within each block, so blocks
stay together even when those values overlap. Inferred values only appear on effective menu items.

Menu items may also declare `tooltip` and `embedded`. `tooltip` supplies the navigation anchor's tooltip text. The Page sidebar uses an item's
description as its tooltip when no explicit tooltip is present. When rendered by `x-menu`, an
`embedded` menu item causes `x-menuitem` to host its target Page inline instead of rendering a navigation anchor. This presentation behavior belongs
specifically to `x-menu` / `x-menuitem`; it is distinct from Navigation's dialog or embedded Page lifecycle and from `xshell.ui.layout.embed`.

`childrenSource` belongs on a menu item and adds dynamically resolved children to that item. A definition's `source` contributes root items:

```jsonc
{
    "navigation": {
        "items": [{ "label": "Customers", "href": "/pages/customers.js", "childrenSource": "customer-pages" }]
    },
    "tools": { "source": "report-tools" }
}
```

Here `customer-pages` supplies only `Customers` children, while `report-tools` supplies the entire `tools` menu. Source names are runtime lookup
identifiers, not URLs or resolver entries. They provide runtime data without mutating the readonly effective configuration.
Named Area menu sources are registered during module startup, so configuration validation does not check whether they exist.

The bundled `x-demo` and `xshell-docs` modules use `"navigation": { "source": "/pages" }`. Areas derives a hierarchy from each module's normalized
`moduleConfig.files` inventory. It recognizes `.js`, `.html`, and `.md` Pages; HTML destinations become `.js`, while Markdown retains `.md`.
An `index` Page is the directory destination. Numeric filename and directory prefixes such as `03-navigation` set order and are removed from
labels and friendly path segments. When a Page inventory entry has generated `resource` metadata, its title overrides the filename-derived label
and its description and icon are copied to the generated menu item. A nested directory's `index` Page supplies that directory item's metadata.
Missing metadata retains the filename fallback, and the module label continues to name the root menu item. This is a menu-generation convention
over the generated inventory, not a parallel authored menu catalog. Registered runtime sources and `childrenSource` remain separate mechanisms.
The Page search traverses these effective nested menus across Areas and matches both labels and descriptions case-insensitively; duplicate href
targets retain their first result, including the original target and Area category.

Bootstrap first maps module-relative menu hrefs into `/_assets/<module-id>/<generation>/...`. Areas then applies the Area prefix to both local `path` and local
`href`, leaving external scheme URLs unchanged. For example, authored `components` and normalized
`/_assets/x-demo/<generation>/pages/01-components/index.js` become `/main/components` and
`/main/_assets/x-demo/<generation>/pages/01-components/index.js` in the `main` Area. The Area home is `path || href` of the first
`navigation` default item in depth-first traversal. If that result has no target, it falls back to the first depth-first item with `path || href`,
testing each item before its children. Despite the helper's "visible" name, no visibility flag is tested. `home` is null only when neither search
returns a target. A targetless default ends that search at its current sibling level; fallback still runs.
Home is computed during `Areas.init()` and is not recomputed by later children refreshes.
On a fresh load at the selected mode's empty/root URL, Navigation requires the default Area to have a home.

Menu scope controls composition, not lookup. `areas.getMenu(name, areaId = null)` first looks for the name in the requested or current Area and then
falls back to the shared global definition. An omitted or null Area uses the current Area; when no Area exists, global menus remain available. An
unknown explicit Area returns `null` without falling back to a global menu.

`areas.getMenus(areaId = null)` returns all menus accessible in the requested or current Area: Area definitions in their effective insertion order,
followed by global definitions in composition order. It returns only global menus when no Area exists and `[]` for an unknown explicit Area. If a
name occurs in both internal collections defensively, the Area definition appears once.

```javascript
// Retrieve an Area menu.
const navigation = areas.getMenu("navigation");

// Retrieve a global menu through the same API.
const preferences = areas.getMenu("preferences");

// Retrieve all menus accessible in the current or a specific Area.
const menus = areas.getMenus();
const adminMenus = areas.getMenus("admin");
```

Each definition has `name`, `scope`, `label`, `description`, `icon`, and `items`. After merging, missing metadata defaults to the menu name for
`label`, an empty string for `description`, and `null` for `icon`. Menu lookups return `null` for an unknown name. Authored empty menus have `items: []`.
Definitions and their root arrays are frozen. Dynamic item children can still refresh through their registered source.
Pass a definition's `items` array to renderers such as `x-menu`, for example `areas.getMenu("navigation")?.items || []`.

`resolveHref(href, areaId = null)` searches all effective menus recursively in only the selected Area when `areaId` is supplied. Without an explicit
Area, it derives the module id from the canonical `/_assets/<module-id>/...` href and searches only Areas that compose that module. Static and
dynamic effective menus participate equally. Query parameters and fragments are ignored when comparing canonical href identity. The matching
effective item lets Navigation expose its optional friendly `path`.
`getMenuitemBreadcrumb(href, areaId = null)` searches only that Area's effective menus by canonical href, defaulting to the current Area. Its
entries retain both the canonical `href` and optional friendly `path`, so breadcrumb UI can use a ready-to-navigate friendly link without
performing translation itself.
`Areas.registerSource(name, source)` registers a source before Areas composition. A source exposes `resolve()`, which returns menu items, and may
declare `dependsOn`, an array of Bus event names. For `childrenSource` targets, an event refreshes their effective children and emits
`xshell:menus:change` when content changed. Each refresh merges the latest source items into the static children. When a source override
disappears, the static item is restored. The definition's root `source` resolves once during `Areas.init()`.

## Routes

`area.routes` is an ordered, read-only array of route descriptors composed from the runtime modules listed in `area.modules`:

```jsonc
[
    { "path": "/something", "href": "/_assets/x-demo/<generation>/pages/index.js", "module": "x-demo" },
    { "path": "/settings", "href": "/_assets/x/<generation>/pages/settings.js", "module": "x" }
]
```

Composition visits modules in Area declaration order and each module's route properties in declaration order. Duplicate paths are preserved rather than
overwritten. Modules without routes contribute nothing, and a module may contribute independently to multiple Areas. Route paths and targets are
copied exactly from `module.routes`; Area prefixes are not applied. Areas do not match routes, extract placeholders, or rewrite targets. Navigation
uses these declarations for forward and reverse URL resolution. The first matching forward route or first applicable reverse route wins in this
composition order; Areas neither rank nor reorder candidates. Routes remain separate from menus.

## Navigation context

An Area prefix marks a navigation context; `/_assets/<module-id>/...` marks resource ownership. Effective menu `path` and `href` values are Area-aware
after composition; neither should be described as an unprefixed physical resource URL. Route descriptors remain Area-relative until Navigation
resolves them. A configured `"inventory"` or
`"/inventory/"` normalizes to `"/inventory"`. Empty or root prefixes normalize to `""`. Prefix matching uses complete segments and tries the
longest prefix first. Navigation resolves a friendly path through `Areas.resolvePath(path)` to its canonical Area-aware href. At page load,
`x-page` removes the matched Area prefix before module resource resolution while retaining the prefixed canonical URL for navigation and
breadcrumbs.

When Navigation emits `xshell:navigation:end`, Areas resolves the current Area from the URL. A change emits `xshell:area:change`.
Menu UIs should refresh on that event; `xshell:menus:change` is reserved for dynamic menu-content updates.

## Current implementation limits

Both hash and path navigation apply Area prefixes. Bootstrap's generic configuration merge can accept Area definitions from dependency fragments even
though Area composition belongs to the root application. Dynamic `childrenSource` content can refresh; complete named menu sources are composed once.

See [Navigation](../10-architecture/120-navigation.md), [Configuration](../10-architecture/20-configuration.md),
[Module Specification](../50-specifications/module.md), and [ADR-0005](../60-adr/0005-area-menu-composition.md).

## Global menus

Areas automatically discovers global menu names from module definitions with `scope: "global"`. The former
`xshell.services.areas.options.global` setting has been removed. Areas composes each global menu once from all selected modules that contribute to it,
in configuration module order. Global definitions remain in their separate internal collection but are available through `getMenu()` and
`getMenus()`. They remain excluded from Area navigation lookup, breadcrumbs, and home calculation.

Global menus use the same metadata, recursive item merge, and ordering rules as Area menus. Global contributions support static `items` and
metadata. Root `source` and nested `childrenSource` are reserved for Area menus. Global targets keep their normalized module hrefs without an Area
prefix.

The `x` module's generic Workspace Page accepts any accessible named menu through the `menu-name` query parameter.
It uses the definition's label, description, and icon for Page metadata and renders `items` in the sidebar. Its `src` query parameter selects the
embedded Page and reflects its current target. Without `src`, Workspace selects the first item with an href. The `show-title` query parameter
controls the embedded Page heading.

See [Bus](20-bus.md) for source refresh events.

## Working example

When the host application registers the optional `x-demo` module, `page:x-demo:/pages/03-navigation/02-areas.js` provides a live Area and composed-menu
inspector. The locator identifies the cookbook Page through Resolver → Loader; it is not a browser-facing navigation URL.
