# DataSets

DataSets are first-class logical resources with the `dataset:` prefix. They use the same Resolver → Loader architecture as icons, modules,
Components, and Pages:

```text
dataset:<locator>
    ↓
Resolver rule
    ↓
resolved URL + resource-specific loader
    ↓
Loader
    ↓
materialized DataSet JSON object
```

V0 returns a plain, fully materialized object. It does not return a data-source handle or an object with a `query()` method. The DataSet-specific
loaders also differ from generic JSON loading: the `dataset:` prefix selects a DataSet resolver rule and loader, while a generic JSON loader only
parses JSON for its own resource type.

## Loading from Components and Pages

Definition-based Component and Page controllers receive the shared Loader service through the controller service provider:

```js
controller({ loader }) {
    return {
        async loadStatuses() {
            const dataset = await loader.load(
                "dataset:static:A=Active|I=Inactive"
            );

            const table = dataset.tables[0];
            const rows = table.rows;
        }
    };
}
```

`loader.load(...)` resolves the logical reference, imports the rule's resource-specific loader when necessary, and returns its result. A Component
or Page may alternatively declare a DataSet in its `dependencies` object when it is known while the definition is loaded; it then receives the
loaded value through `controller({ dependencies })` like any other declared resource.

## Inline static DataSets

The built-in static locator represents a small list of key/value pairs:

```text
dataset:static:A=Active|I=Inactive|S=Suspended
```

`dataset-static` splits the definition at each `|` and splits each entry at its first `=`. It creates an `items` table with `key` and `value`
string columns:

```json
{
  "tables": [
    {
      "name": "items",
      "columns": [
        { "name": "key", "type": "string" },
        { "name": "value", "type": "string" }
      ],
      "rows": [
        { "key": "A", "value": "Active" },
        { "key": "I", "value": "Inactive" },
        { "key": "S", "value": "Suspended" }
      ]
    }
  ]
}
```

The syntax has no escaping or decoding layer. Keys cannot contain `|` or `=`, values cannot contain `|`, and an entry without `=` fails the load.
A value may contain additional `=` characters because only the first one separates key from value. Whitespace and duplicate keys are preserved;
the loader does not trim values or enforce uniqueness. `?` and `#` are also unsuitable as data because the Resolver removes query and fragment
text before it matches any logical resource.

## URL DataSets

The URL locator fetches JSON and returns the parsed value. An application-base-relative locator without a leading slash is the reliable built-in
form:

```js
const relativeDataset = await loader.load(
    "dataset:url:api/customers"
);
```

The following forms are accepted by the resolver pattern, but have important V0 resolution limitations:

```js
const leadingSlashDataset = await loader.load(
    "dataset:url:/api/customers"
);

const remoteDataset = await loader.load(
    "dataset:url:https://example.com/api/customers"
);
```

The rule's source template is `{definition}`. The current Resolver constructs that template relative to the application base URL before replacing
the placeholder. For an application at `https://app.example/console/`, the three examples resolve as follows:

```text
dataset:url:api/customers
    → https://app.example/console/api/customers

dataset:url:/api/customers
    → https://app.example/console//api/customers

dataset:url:https://example.com/api/customers
    → https://app.example/console/https://example.com/api/customers
```

Therefore a leading slash does not mean origin root and retains a doubled slash after the application base. More importantly, an HTTP(S) locator
does not currently become a cross-origin absolute URL; it is inserted into the application-relative template. Applications needing a cross-origin
DataSet must provide a custom resolver rule whose `src` itself is an absolute URL. This differs from bare HTTP(S) resources handled by the
`response-http` rules.

`dataset-url` uses `fetch`, rejects non-success HTTP responses with the status and status text, and then calls `response.json()`. The response is
expected to already use the [DataSet JSON format](../50-specifications/dataset.md). V0 does not convert an arbitrary API response into that format,
and the loader does not validate the parsed object against the DataSet schema. Invalid JSON rejects through the normal Loader error path.

URL loading follows browser Fetch restrictions. When a custom rule resolves a DataSet to a cross-origin URL, that request requires CORS permission,
and the application's Content Security Policy must permit the destination through `connect-src`.

The current Resolver removes the first query string and any fragment from every logical resource before rule matching. Consequently,
`dataset:url:api/customers?page=2` fetches the application-base `api/customers` URL without `?page=2`. Fragments are removed as well. V0 therefore
does not support query parameters in URL DataSet locators.

## Module-owned DataSets

A module exposes a conventional DataSet by storing a JSON file below its `datasets` directory:

```text
<module>/datasets/countries.json
```

Consumers use the module id and an extensionless logical name:

```js
const dataset = await loader.load(
    "dataset:x-demo:countries"
);

const table = dataset.tables[0];
const rows = table.rows;
```

After module discovery and asset normalization, bootstrap generates this rule for every canonical module:

```jsonc
"dataset": {
    "<module-id>:{path}": {
        "src": "/_assets/<module-id>/<generation>/datasets/{path}.json",
        "loader": "dataset-url",
        "cache": false,
        "moduleId": "<module-id>",
        "modulePath": "/_assets/<module-id>/<generation>"
    }
}
```

The `{path}` placeholder matches one or more characters and may contain `/`, so an extensionless reference such as
`dataset:orders:lookups/statuses` resolves to `datasets/lookups/statuses.json`. Bootstrap does not check the inventory before generating this
general rule; a missing file fails when fetched.

Module qualification makes ownership explicit. `dataset:x-demo:countries` resolves through the `x-demo` assets regardless of which Component or
Page requests it, so the consuming resource's own module does not change its meaning. The `x-demo` module demonstrates this with
`datasets/countries.json` and the **Advanced / DataSet** Page at `pages/90-advanced/08-dataset.js`.

## Additional rules and loaders

Modules may contribute more entries under `xshell.resolver.dataset`. A rule can select a built-in loader or a module-provided resource-specific
loader. Module-relative `/...` values in authored module configuration are normalized into that module's versioned asset namespace:

```jsonc
{
    "xshell": {
        "resolver": {
            "dataset": {
                "service:{name}": {
                    "src": "app:/api/datasets/{name}",
                    "loader": "/loaders/dataset-service.js",
                    "cache": true
                }
            }
        }
    }
}
```

The custom loader module must default-export a class with a `load(url, context)` method that returns, or resolves to, the materialized DataSet
object. This extends the existing Resolver → Loader mechanism; it does not create a provider registry or a separate Data Source framework.

## Caching

The built-in `static:`, `url:`, and generated module-owned rules do not enable Loader caching. Browser HTTP caching can still apply to fetched
resources independently. A custom resolver rule may set `cache: true` and optionally choose `cacheMode: "full"` or `cacheMode: "path"` as described
in [Loaders](90-loaders.md#cache-identity). Query removal during Resolver resolution remains a separate V0 limitation.

## V0 boundaries

V0 does not provide:

- dynamic querying or searching;
- paging, streaming, or incremental materialization;
- CRUD operations or mutation persistence;
- database-specific operations;
- relations or constraints between tables;
- automatic conversion of arbitrary HTTP response shapes;
- query strings in DataSet URL locators;
- cross-origin absolute URLs through the built-in `dataset:url:` rule;
- automatic runtime validation of loaded DataSets against `dataset.schema.json`.

Application code reads the returned JSON object directly, normally beginning with `dataset.tables[0]`. See the
[DataSet JSON specification](../50-specifications/dataset.md) for its descriptive structure and validation boundary.
