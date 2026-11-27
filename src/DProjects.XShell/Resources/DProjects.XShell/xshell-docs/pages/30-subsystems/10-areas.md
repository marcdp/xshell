# Areas

An Area is a navigation context with a prefix, selected menu slots, and configured routes. Several Areas can expose the same loaded resource.
Navigation owns browser URLs, history, Page stacks, and activation.

## Configuration and ownership

Configure `xshell.services.areas.options.default` and `xshell.services.areas.options.definitions` in the application manifests.
Each definition can supply `prefix`, `label`, `icon`, `description`, `order`, `menus`, and `routes`. The `menus` map assigns logical slots to named Menus definitions.
An unknown default Area, an invalid route, or an invalid menu selection fails startup. The configured default appears first, then Areas sort by `order` and `label`. With a null default, the first
sorted Area becomes the initial current Area.

```jsonc
{
    "xshell": {
        "services": {
            "areas": {
                "options": {
                    "default": "customers",
                    "definitions": {
                        "customers": {
                            "prefix": "customers",
                            "label": "Customers",
                            "menus": { "navigation": "report-navigation" },
                            "routes": { "/reports/{id}": "/pages/report.js" }
                        },
                        "inventory": {
                            "prefix": "inventory",
                            "label": "Inventory",
                            "menus": { "navigation": "report-navigation" }
                        }
                    }
                }
            },
            "menus": {
                "options": {
                    "definitions": {
                        "report-navigation": {
                            "label": "Reports",
                            "items": [{
                                "id": "reports", "label": "Reports", "path": "reports",
                                "href": "/pages/report.js", "default": true
                            }]
                        },
                        "shortcuts": {
                            "scope": "global",
                            "items": [{ "label": "About", "href": "/pages/about.js" }]
                        }
                    }
                }
            }
        }
    }
}
```

## Menus and home

Menus owns definitions under `xshell.services.menus.options.definitions.<name>`. Any selected module manifest can extend the same definition.
Bootstrap normalizes each manifest's resource references and applies the [generic configuration merge](../10-architecture/20-configuration.md#merge-and-precedence).
A matching non-empty string item ID merges in place within its sibling array, including nested `children`. Later metadata values follow ordinary
configuration precedence. Identified items can omit a label supplied by an earlier manifest. A targetless identified group with children can use
an empty effective label.

Each definition can supply `scope`, `label`, `description`, `icon`, static `items`, and Area-only `sources`. The default scope is `"area"`.
Missing display metadata defaults to the definition name, an empty description, and a null icon. Menus sorts each sibling array by numeric
`order`, using zero for omitted values. Ties retain their order in the merged array. Set explicit values to position entries across manifests.

Menus contextualizes each selected Area menu independently. It applies the Area prefix to local `path` and `href` and leaves external URLs intact.
Use a bare relative string such as `"reports"` for an authored friendly path and `"/pages/report.js"` for a manifest-relative resource. The
example produces `/customers/reports` as the friendly path and `/customers/_assets/reports/<generation>/pages/report.js` as its canonical
Area-aware href. Menu items expose the canonical target's module id when the href uses the assets namespace. Targetless entries have a null
module. Areas can expose resources from any loaded module through their menu selections and route definitions. Module dependencies govern loading.

Areas derives `home` at startup from the selected Area-scoped `navigation` menu. The default search visits parents before children and uses
`path || href`. A targetless default ends that search in its sibling array. The first depth-first destination supplies the fallback when
the default search yields no destination. An Area without a navigation destination has a null home. Source refreshes leave the startup home fixed.

```javascript
const navigation = menus.getMenu("navigation");
const preferences = menus.getMenu("preferences");
const inventoryMenus = menus.getMenus("inventory");
```

`getMenu(name, areaId)` resolves a global definition by its canonical name or a slot in the requested or current Area. Area slots can select only
Area-scoped definitions and must use names distinct from every global menu. Invalid selections and name conflicts fail before module controllers
start. `getMenus(areaId)` lists the contextual slots in selection order, then every global definition once in configuration order. An unknown
explicit Area yields `null` or `[]`, respectively. Global definitions are available even without configured Areas. Effective definitions and
their item trees are read-only. Read `menu.items` again after a change event to obtain the latest snapshot.

`menus.resolvePath(path)` asks Areas which Area owns the path and searches only that Area's contextual menus for an exact friendly alias with an
`href`. It returns `null` if the path has no owner or no matching alias. Menus checks all slots and descendants during startup and source refresh.
Every navigable alias must belong to the Area exposing it. Aliases in another Area, in the reserved global navigation namespace, or outside all
Areas fail validation. Targetless groups can keep organizational paths and are exempt from this check. Repeated aliases may share a destination,
including its default query parameters and fragment. Conflicting destinations fail with the Area, path, and contributing slots.

`menus.resolveHref(href, areaId)` matches canonical identity
without query parameters or fragments. A supplied Area ID or a recognized non-empty href prefix limits the lookup to that Area. For an unqualified
href, Menus searches effective destinations in the current Area, then the other Areas in their configured sort order. `menus.getMenuitemBreadcrumb(href, areaId)` returns the matching Area's depth-first ancestor
chain for the canonical Area-aware href. Breadcrumb entries carry `path` and `href` for navigation.

### Sources

Set `sources` to an ordered array of objects with a `source` string and optional merge `id`. Menus applies each source's root items in array
order after the static items. A source starting with `/` names an inventory directory relative to the manifest. A named source comes from
`menus.registerSource(name, source)`. Use `childrenSource` on an item to merge a named source into that item's static children.

```jsonc
{
    "management": {
        "items": [{ "label": "Customers", "childrenSource": "customer-pages" }],
        "sources": [
            { "id": "customers", "source": "/pages/customers", "path": "customers", "default": true },
            { "id": "inventory", "source": "/pages/inventory", "path": "inventory", "default": false },
            { "id": "tools", "source": "report-tools" }
        ]
    }
}
```

An inventory source accepts an optional Area-relative `path` prefix and boolean `default` for its generated root. In the `/main` Area, the
example generates roots at `/main/customers` and `/main/inventory`, and descendants such as `/main/customers/help` and `/main/inventory/help`.
Leading and trailing slashes on the prefix are optional. Bootstrap preserves the authored prefix as text and normalizes the `source` resource
path against its module. An omitted or empty prefix uses the Area root. An omitted `default` keeps the root eligible for home selection,
with the first eligible destination winning in menu order. Set `default: false` to skip the default search for that root. It remains
eligible for the ordinary home fallback. Registered source references accept `id` and `source`.

An inventory source selects its module inventory by the normalized asset path. Menus generates entries for JavaScript, HTML, and Markdown
Pages. HTML Page hrefs use `.js`, and Markdown keeps `.md`. Directory index Pages provide directory destinations. Numeric file and directory
prefixes determine generated order and are removed from labels and friendly path segments. Page metadata can supply a title, description,
and icon. The module label names the generated root item.

Module controllers register runtime sources during initialization. A source exposes `resolve()` and can list Bus events in `dependsOn`.
Call `source.refresh()` or emit a dependency event to refresh root or child content. Menus validates every affected Area before publishing
new snapshots. Invalid ownership or conflicting destinations cause `refresh()` to throw and leave all previous menus effective. On a valid content
change, Menus publishes the read-only snapshots and emits `xshell:menus:change`. A removed source override exposes the original static entry again.

## Routes

Declare Area-relative patterns and non-empty Page target strings under `xshell.services.areas.options.definitions.<area-id>.routes`. Multiple
manifests can extend the same Area. Bootstrap normalizes targets against their declaring manifests before applying the
[generic configuration merge](../10-architecture/20-configuration.md#merge-and-precedence). Pattern keys stay literal. Distinct keys keep their
merge order, and a later value for the same key replaces the earlier value in place.

The Areas service validates patterns before module controllers execute. The effective `area.routes` array and its descriptors are read-only:

```jsonc
[
    { "path": "/reports/{id}", "href": "/_assets/reports/<generation>/pages/report.js", "module": "reports" }
]
```

The `module` field identifies the owner of the canonical resource, or is null when no module owns the target path. An Area without route
declarations exposes an empty array. [Navigation](../10-architecture/120-navigation.md#menus-routes-and-canonical-targets) matches routes within
the owning Area and generates public URLs. Menu aliases take precedence, followed by the first matching pattern in effective declaration order.

## Navigation context

An Area prefix marks a navigation context; `/_assets/<module-id>/...` marks resource ownership. Effective menu `path` and `href` values are Area-aware
after composition; neither should be described as an unprefixed physical resource URL. Route descriptors remain Area-relative until Navigation
resolves them. A configured `"inventory"` or
`"/inventory/"` normalizes to `"/inventory"`. Empty or root prefixes normalize to `""`. Overlapping Area prefixes are supported. Areas uses the
longest prefix that matches on a segment boundary to determine which Area owns the path. An empty-prefix Area can own paths outside more specific
Areas. Navigation resolves a friendly path through `menus.resolvePath(path)` to its canonical Area-aware href. At page load,
`x-page` removes the matched Area prefix before module resource resolution while retaining the prefixed canonical URL for navigation and
breadcrumbs.

When Navigation emits `xshell:navigation:end`, Areas resolves the current Area from the URL. A change emits `xshell:area:change`.
The Main sidebar reads the Area associated with its owning Page and refreshes on Area and dynamic menu changes.

`areas.globalPrefix` exposes the effective [global navigation prefix](../10-architecture/120-navigation.md#global-navigation).
`areas.resolveAreaId(href)` returns `null` for this namespace before testing any Area, including an empty-prefix Area. A global Page therefore
leaves the active Area intact and has no Area menu or Area-derived breadcrumb. `areas.getAreas()` lists the configured Areas only.

## Global menus

Set `scope: "global"` for menus available throughout the application. Global lookups use their definition names. Their hrefs keep the normalized
resource paths and global definitions support static items only. Area home, alias, and breadcrumb lookup use the Area-scoped menu projections.

## Keyboard shortcuts

Declare `shortcut` on a root or nested menu item as a string or a non-empty array of strings. Each entry is an independent combination, and the
menu displays the first entry as its hint. For example, `"shortcut": ["Ctrl+K", "Meta+K"]` gives one item both combinations. Shortcut arrays concatenate under the ordinary manifest merge. An incoming string or array of a different type replaces the previous value.

XShell activates the effective item through its mounted menu control when available. Commands
raise the usual bubbling UI `command` event. Links use their friendly `path` or canonical `href` and retain their Page presentation mode or browser
`target`. When a command or link has no mounted control, XShell dispatches the command in the current Page or uses Navigation with that Page's
context. A group with children and no direct action needs a mounted menu control to toggle its submenu.

The bundled global Search item opens its submenu with `Ctrl+K`. The submenu loads the embedded Search Page and uses its existing focus behavior.
Pressing the shortcut again closes the submenu.

```jsonc
{
    "scope": "global",
    "items": [{
        "id": "search",
        "label": "Search",
        "icon": "x-search",
        "shortcut": "Ctrl+K",
        "children": [{ "label": "Search Options", "href": "/pages/search.js", "open": "embed", "outlet": "self" }]
    }]
}
```

Use one or more distinct modifiers (`Ctrl`, `Shift`, `Alt`, `Meta`), followed by one logical key. Parsing ignores case, modifier order, and
whitespace around each token. The pressed modifiers must match exactly. `Ctrl` is Control on every platform. The key is matched using
`KeyboardEvent.key`, so printable characters follow the active keyboard layout. Supported keys are ASCII letters, digits, punctuation
(including `,` and `Plus`), `Space`, `F1` through `F24`, the four `Arrow` keys, `Enter`, `Escape`, `Tab`, `Backspace`, `Delete`, `Insert`,
`Home`, `End`, `PageUp`, and `PageDown`. For example, `Ctrl+Shift+P`, `Alt+F`, `Meta+K`, and `Ctrl+,` each describe one combination.

Global shortcuts are available throughout the application. Area shortcuts are available in the current Area. If several enabled actions claim the
same normalized combination, XShell disables that binding and logs the conflicting menu items. Other combinations on those items remain active.
Repeated declarations of the same combination on one item count as one binding. Invalid combinations are ignored with a diagnostic.
XShell refreshes bindings on Area changes and effective menu updates. Disabled items and their descendants are skipped. The app sidebar hides
shortcut hints when collapsed, while the bindings remain active.

In inputs, textareas, and editable content, XShell accepts printable shortcuts with `Ctrl` or `Meta` and without `Alt`, including `Ctrl+K`.
Space, navigation and deletion keys, and the usual select, copy, paste, cut, undo, redo, and rich-text editing chords stay with the editor.
XShell also ignores repeated, composing, AltGraph, and already-canceled key events. Browsers and operating systems may reserve combinations
before the application receives them.

## Workspace

The `x` module's Workspace Page takes the menu identifier in its `menuName` property (`menu-name` in the URL) and the selected menu item ID
in `item`. It uses the effective menu's label, description, and icon for Page metadata and displays the menu tree in its sidebar.

Give each navigable Workspace item a stable, non-empty `id` that is unique throughout the effective menu tree. Contributions with the same ID
in one sibling array still merge under the generic manifest merge. Separators, command items, and groups without a Page target do not need IDs.

Workspace looks up the requested ID throughout the tree and opens the item's effective destination. If the ID is missing or unknown, Workspace
selects the first navigable item in depth-first menu order. A missing menu or a menu with no navigable items leaves the content empty.
Workspace reflects the selected ID by replacing the current URL. Navigation within the embedded Page keeps that selection. The former `src`
query parameter has been removed. Use `show-title=false` to hide the embedded Page heading.

See [Preferences](110-preferences.md) for links to individual sections.

## Working example

When the host application registers the optional `x-demo` module, `page:x-demo:/pages/03-navigation/02-areas.js` provides a live Area and composed-menu
inspector. The locator identifies the cookbook Page through Resolver → Loader; it is not a browser-facing navigation URL.
