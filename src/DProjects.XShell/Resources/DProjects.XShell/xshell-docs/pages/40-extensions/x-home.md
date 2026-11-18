# Home launcher

`x-home` is an optional module that provides an application launcher. It lists Areas, exposes Pages from composed navigation menus, and lets users
pin Pages they want to revisit.

## Add and open the launcher

Add `"x-home": "module:x-home:latest"` to the consuming module's `dependencies` in its manifest. The module brings in the `x` UI dependency.
Open the Home Page with `page:x-home:/pages/index.js`. Pass `?areaId=operations` to show Quick Links for a specific Area.

To embed the launcher in an X Template Page, declare the resource dependency and use the Component in the template.

```js
export default {
    dependencies: { home: "component:x-home" },
    template: `<x-home></x-home>`
};
```

The optional `area-id` attribute or `areaId` property selects the Quick Links Area. An omitted or empty value follows the current Area.

## Areas, Quick Links, and favorites

Area tiles come from `areas.getAreas()`. Each uses the Area's composed home destination, when available, and the current Area is highlighted.
Quick Links traverses the selected Area's composed `navigation` menu, including nested Pages. It uses friendly paths when present and falls back to
canonical Page hrefs. Menu groups and command-only entries are skipped. Area and menu changes refresh the launcher.

Favorites are stored as a deduplicated list of friendly paths in the browser-local [Preferences](../30-subsystems/110-preferences.md) entry
`x-home.favorites`. Pages with only a canonical href are still available in Quick Links. The launcher resolves favorites across all composed Area
menus and hides entries whose destinations are currently missing.

## Use Home as an Area landing Page

Adding the dependency makes the Component and Page available. To contribute the launcher to an Area's navigation, include `x-home` in that Area's
`modules` list. Its contribution declares `"path": "home"`, which becomes `/home` under the Area prefix.

For example, an application with an `operations` module could use the following `xshell.services.areas.options` in its root manifest.

```json
{
    "default": "operations",
    "definitions": {
        "operations": {
            "prefix": "operations",
            "modules": ["x-home", "operations"]
        }
    }
}
```

With this order, Home is the first destination and becomes the landing Page if no composed entry is marked `default: true`.
An existing default entry takes precedence. To choose Home explicitly, remove that default marker and keep `x-home` first.
See [Areas](../30-subsystems/10-areas.md) for composition and home selection.
