# Resolvers

A Resolver maps a logical resource such as `icon:x-file` to a concrete resource location and loader metadata. The Loader then obtains the resource.
They are separate responsibilities. Generated resolver entries currently use generation-qualified, application-root-relative virtual Paths such as
`/_assets/x/<generation>/icons/x-file.svg`. See [Configuration](20-configuration.md#path-and-url-terminology).

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

Bootstrap generates conventional rules for module icons, layouts, components, pages, and JavaScript modules. The checked-in default prefix is
`/_assets`. Rules for a canonical module definition are generated once, regardless of repeated dependency references.

Resolver patterns consist of literal text and named placeholders. Placeholder names follow `[A-Za-z_][A-Za-z0-9_]*`, and literal text has no
regular-expression semantics. `{name}` matches one nonempty resource-name segment; it excludes `/`, `\\`, `?`, `#`, and `%`, and cannot be `.` or
`..`. `{path}` matches one or more nonempty relative path segments separated by `/`; it cannot begin or end with `/`, contain empty, `.`, or `..`
segments, or contain `\\`, `?`, `#`, or `%`. Rejecting `%` also rejects encoded separators and traversal for this resolver version.

In a module-root rule such as `dataset:x-demo:/{path}`, the leading `/` is literal and is not part of the captured path. Thus
`dataset:x-demo:/datasets/countries.json` captures `datasets/countries.json`, while `dataset:x-demo:countries` is suitable for a `{name}` rule.
Values such as `dataset:x-demo:crm/customers`, `dataset:x-demo:/crm/../config.json`, and `dataset:x-demo:/crm//customers.json` do not match those
respective rules. Other placeholder names retain the existing generic matching behavior for compatibility. Multiple placeholders must be separated
by literal text; malformed, adjacent, or duplicate placeholders are invalid.

`resolver.js` reads nested `config.xshell.resolver` rule objects. Bootstrap adds defaults for each canonical module id after merging. Resolver
matching and loader dispatch still require the usual resource location and loader metadata.

Absolute HTTP(S) URLs are a built-in Resolver case and do not require an authored rule. The built-in `http:` and `https:` rules map these resources
to their absolute URL and the `response-http` loader. Resolver still determines the resource location and loader metadata; Loader coordinates the
load, and the resource-specific loader obtains the `Response`. See [Absolute HTTP(S) resources](90-loaders.md#absolute-https-resources) for the
return value, caching, and browser security behavior.

Resolver rule `src` may be an application Path or an absolute URL. `Resolver.resolve()` returns `path` as the resolved application Path (or `null`
for an absolute URL source) and `url` as the resolved absolute URL.

Resolver entries may set `cache: true` and optionally select `cacheMode: "full"` or `cacheMode: "path"`. The default `full` mode includes the query
in Loader cache identity. The `path` mode excludes the query from cache identity without changing resolution or the URL passed to the
resource-specific loader. Bootstrap uses `path` for its generated Page rules; unrelated generated rules retain the default `full` behavior.

## Declarative component and Page dependencies

Values in a Component or Page implementation's `dependencies` object are ordinary logical resource references, such as
`module:/_assets/x/<generation>/utils/markdown.js`, `icon:x-file`, or `component:x-code-editor`. The Resolver determines which resource definition matches a
reference and maps it to its URL and loader metadata. The Loader then obtains that resource and exposes the value under the declaration's key in
`controller({ dependencies })`.

`dependencies` is therefore a declarative way for a definition-based Component or Page to request known resources through the existing Resolver
and Loader infrastructure; it is not a separate resolver rule set or dependency-injection system.

See [Configuration](20-configuration.md) and [Loaders](90-loaders.md).

Bootstrap also generates exact `contract:<id>` rules from module inventory entries under `/contracts/`.
These use `object-json` and preserve module ownership metadata; see [Services](100-services.md).
Resolver generation consumes the normalized inventories already supplied by the descriptors and happens before effective schema validation.

Bootstrap also generates a general `dataset:<module-id>:{path}` rule for each canonical module. It maps an extensionless logical name to the
module's versioned `/datasets/{path}.json` asset and selects `dataset-url`. See [DataSets](95-datasets.md) for the built-in locators, nested paths,
query-string limitation, and returned value.
