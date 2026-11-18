# Dialogs

The `dialog` service opens Pages through `navigation.navigate({ open: "dialog", ... })` and awaits their closing result.

| Method | Parameters and selected resource |
| --- | --- |
| `confirm({ title, message, variant })` | `xshell.services.dialog.options.confirm` |
| `message({ type, title, message })` | `xshell.services.dialog.options.message` |
| `prompt({ title, message, value, inputType, placeholder, required })` | `xshell.services.dialog.options.prompt` |
| `picker({ title, message, value, inputType, placeholder, domain, multiple, required })` | `xshell.services.dialog.options.picker` |
| `language({ title, message, value, required, current } = {})` | Builds a language domain and invokes picker with radios. |
| `open({ href, params, title, breadcrumb, icon, context })` | Opens the supplied Page with params, navigation metadata, and context. |

The first four helpers pass fields as Page creation context. `language()` uses `i18n.config.langs`, excludes IDs in `current`, and defaults to
required selection. It forwards `value` to the radios picker and returns the selection without switching language.

`xshell.services.dialog.options` selects the standard **Page resources**. The Dialog implementation owns and validates these optional settings through
its static `optionsSchema` when the service is first resolved. `xshell.ui.layout.dialog` selects the **presentation layout**. Changing the layout does
not change the helper Page.

```jsonc
"xshell": {
    "services": {
        "dialog": {
            "options": {
                "confirm": "/pages/dialog-confirm.js",
                "message": "/pages/dialog-message.js",
                "prompt": "/pages/dialog-prompt.js",
                "picker": "/pages/dialog-picker.js"
            }
        }
    }
}
```

## Results

A Page calls `page.close(result)`, which delegates to its hosting `x-page`.
Navigation listens for the `x-page` close event, preserves the result, and awaits `removePage()` before resolving its promise. Dialog close is a final
Page destruction path: the Page unmounts and unloads, then the host is removed. A cleanup failure rejects the dialog promise.
Navigation stack updates close open dialogs through this same path.
The checked-in x-demo result dialogs use this pattern:

```js
controller({ page }) {
    return {
        accept() {
            page.close({ accepted: true });
        }
    };
}
```

A caller awaits an arbitrary Page exposed by the composed application:

```js
const result = await dialog.open({
    href: "/pages/04-dialogs/custom-dialog.js",
    title: "Results"
});
```

`x-page` preserves `false`, `0`, and `""` results; an absent or null result is returned as `null`.
The bundled confirm Page returns `"yes"`, `"no"`, `"cancel"`, or `"ok"` according to the chosen button/variant.
Message confirmation returns `"ok"`. Prompt/picker submit their current value, and cancellation returns `null`.
Closing without a result yields `null`. The picker Page contract accepts `select` and `radios` input modes.

See [Pages](../10-architecture/70-pages.md), [Navigation](../10-architecture/120-navigation.md), and [Lifecycle](../20-components/60-lifecycle.md).
