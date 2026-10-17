# Resolvers

A Resolver maps a logical resource such as `icon:x-file` to a concrete resource location and loader metadata. The Loader then obtains the resource.
They are separate responsibilities. Both global and module-qualified locators use this same Resolver → Loader pipeline; qualification does not imply
navigation or a different loading mechanism.

Generated resolver entries use generation-qualified, application-root-relative virtual Paths such as
`/_assets/x/<generation>/icons/x-file.svg`. See [Configuration](20-configuration.md#path-and-url-terminology).

## Resource-addressing conventions

Global resource locators preserve the existing application-wide names and versioned physical Paths:

```text
icon:x-file
layout:x-layout-main
component:x-button
module:x-utils
page:/_assets/x-demo/<generation>/pages/index.js
```

Module-qualified locators put the owning module id immediately after the resource type:

```text
icon:x:x-file
layout:x:x-layout-main
component:x:x-button
module:x:x-utils
module:x-demo:/utils/formatter.js
page:x-demo:/pages/index.js
style:x-demo:/styles/main.css
string:x-demo:/data/info.txt
bytes:x-demo:/images/logo.png
dataset:x-demo:countries
dataset:x-demo:/datasets/countries.json
contract:x:x-button
```

The forms coexist. A qualified locator can select an existing logical resource name, such as `component:x:x-button`, or a physical path relative to
the identified module root, such as `module:x-demo:/utils/formatter.js`. In a root-relative form, the `/` after the second colon is literal. Bootstrap
supplies the module's versioned virtual asset Path in the generated rule. The resource type still selects the resource-specific loader.

For each canonical module, `fillResolverRules()` generates the following conventions. `<assets-path>` is that module's normalized versioned virtual
Path, for example `/_assets/x-demo/<generation>`.

| Type | Global form | Module-qualified form | Loader |
| --- | --- | --- | --- |
| `icon` | `icon:<module-id>`; `icon:<module-id>-{name}` | `icon:<module-id>:<module-id>-{name}` | `icon-svg` |
| `layout` | `layout:<module-id>-layout-{name}` | `layout:<module-id>:<module-id>-layout-{name}` | `component-js` |
| `component` | `component:<module-id>-{name}` | `component:<module-id>:<module-id>-{name}` | `component-js` |
| `page` | `page:<assets-path>/{path}.js`; `.html`; `.md` | `page:<module-id>:/{path}.js`; `.html`; `.md` | `.js` and `.html`: `page-js`; `.md`: `page-md` |
| `module` | `module:<module-id>-{name}`; `module:<assets-path>/{path}.js` | `module:<module-id>:<module-id>-{name}`; `module:<module-id>:/{path}.js` | `module-js` |
| `style` | `style:<assets-path>/{path}.css` | `style:<module-id>:/{path}.css` | `style-css` |
| `string` | `string:<assets-path>/{path}` | `string:<module-id>:/{path}` | `string-any` |
| `bytes` | `bytes:<assets-path>/{path}` | `bytes:<module-id>:/{path}` | `bytes-any` |
| `dataset` | `dataset:<assets-path>/{path}` | `dataset:<module-id>:{name}`; `dataset:<module-id>:/{path}` | `dataset-url` |
| `contract` | exact `contract:<id>` entries discovered from `/contracts/*.json` inventory | `contract:<module-id>:{name}` | `object-json` |

The `.html` Page convention resolves to the corresponding `.js` source. Exact global contract ids can include nested inventory paths without the
`.json` suffix. Bootstrap generates general rules without checking that each requested file exists; a missing resource fails during loading.
Rules for a canonical module definition are generated once, regardless of repeated dependency references.

## Resolver patterns and placeholders

A custom rule may use this nested shape:

```jsonc
{
    "xshell": {
        "resolver": {
            "icon": {
                "x-{name}": { "src": "/icons/x-{name}.svg", "loader": "icon-svg" }
            }
        }
    }
}
```

Resolver patterns consist of literal text and named placeholders. Placeholder names follow `[A-Za-z_][A-Za-z0-9_]*`, and literal text has no
regular-expression semantics.

- `{name}` represents one safe, nonempty resource-name segment. It excludes `/`, `\\`, `?`, `#`, and `%`, and cannot be `.` or `..`.
- `{path}` represents one or more safe, nonempty relative path segments separated by `/`. It cannot begin or end with `/`, contain empty, `.`, or
  `..` segments, or contain `\\`, `?`, `#`, or `%`.

Rejecting `%` also rejects encoded separators and traversal attempts for this resolver version. In a module-root rule such as
`dataset:x-demo:/{path}`, the leading `/` is literal and is not captured: `dataset:x-demo:/datasets/countries.json` captures
`datasets/countries.json`. Other placeholder names retain the compatible generic nonempty matching behavior; they do not receive the `{name}` or
`{path}` safety checks. Multiple placeholders must be separated by literal text. Empty, malformed, adjacent, or duplicate placeholders are invalid
rule definitions.

Examples:

| Locator | Result |
| --- | --- |
| `dataset:x-demo:countries` | Valid `{name}`; resolves below the module's `/datasets/` directory. |
| `dataset:x-demo:/datasets/lookups/countries.json` | Valid `/{path}` from the module root. |
| `module:x-demo:/utils/formatter.js` | Valid `/{path}.js` from the module root. |
| `dataset:x-demo:crm/customers` | Rejected: `{name}` cannot contain `/`. |
| `dataset:x-demo:/crm/../config.json` | Rejected: `{path}` cannot contain `..`. |
| `dataset:x-demo:/crm//customers.json` | Rejected: `{path}` cannot contain an empty segment. |
| `dataset:x-demo:/%2e%2e/config.json` | Rejected: `{path}` cannot contain `%`. |

## Resolution, suffixes, and caching

`resolver.js` reads the nested `config.xshell.resolver` rule objects. `Resolver.has()` and `Resolver.resolve()` remove query and fragment suffixes
before rule matching. The removed suffixes are therefore not substituted into the rule, returned in the resolved `path` or `url`, or passed to the
resource-specific loader. For example, `page:x-demo:/pages/index.js?mode=edit#details` resolves the same location as the unsuffixed locator.

This resolution behavior is separate from Loader cache identity. The Loader receives the original logical reference. With the default
`cacheMode: "full"`, its cache key includes that original query and fragment. With `cacheMode: "path"`, it removes only the query and preserves a
fragment in the cache key. Bootstrap uses `path` for generated Page rules; unrelated generated rules retain `full`. Consequently, global and
module-qualified locators that resolve to the same URL can still have separate cache entries because their logical references differ. See
[Loaders](90-loaders.md#cache-identity).

Resolver rule `src` may be an application Path or an absolute URL. `Resolver.resolve()` returns `path` as the resolved application Path (or `null`
for an absolute URL source) and `url` as the resolved absolute URL.

Absolute HTTP(S) URLs are a built-in Resolver case and do not require an authored rule. The built-in `http:` and `https:` rules map these resources
to their absolute URL and the `response-http` loader. See [Absolute HTTP(S) resources](90-loaders.md#absolute-https-resources) for the return value,
caching, suffix limitation, and browser security behavior.

## Declarative component and Page dependencies

Values in a Component or Page implementation's `dependencies` object are ordinary logical resource references, such as
`module:x:/utils/markdown.js`, `icon:x-file`, or `component:x:x-code-editor`. The Resolver determines which resource definition matches a reference
and maps it to its URL and loader metadata. The Loader then obtains that resource and exposes the value under the declaration's key in
`controller({ dependencies })`.

`dependencies` is therefore a declarative way for a definition-based Component or Page to request known resources through the existing Resolver
and Loader infrastructure; it is not a separate resolver rule set or dependency-injection system.

See [Configuration](20-configuration.md), [Loaders](90-loaders.md), and [DataSets](95-datasets.md).
