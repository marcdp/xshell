# Search

Search is a core, domain-independent Service that federates queries across declaratively configured providers. It does not maintain a central index,
persist search data, execute results, or know about optional domains such as Filesystems. Providers discover current domain metadata when queried and
return serializable navigation records.

## Public contract

The `search` singleton exposes two methods:

```javascript
const providers = search.listProviders();
const {results, errors} = await search.query("documents", {
    providers: ["filesystems", "commands"],
    limit: 20,
    signal: abortController.signal
});
```

`listProviders()` returns frozen descriptors in effective configuration order without loading, constructing, or initializing provider
implementations. Each descriptor contains `id`, `label`, and `mode`, with optional `description` and `icon`. Implementation paths and provider
options are private configuration and are not included.

`query(text, options = {})` trims the text and returns `{results, errors}`. An empty query returns both arrays empty without loading a provider.
The default aggregate limit is 50 and the accepted range is 1 through 200. Supplying `providers` explicitly selects those unique known IDs in the
given order. Omitting it selects every provider whose mode is `default`.

Each result requires `id`, `providerId`, `label`, and `href`. Optional fields are `description`, `icon`, `category`, `tags`, and `open`; `open`
defaults to `top` and supports `top`, `stack`, `dialog`, and `dock`. Results are plain navigation data: callbacks, DOM nodes, Service instances, and
other executable values are not valid. The Service attaches `providerId`; providers do not author or control it. The pair `(providerId, id)` is the
stable aggregate identity.

## Provider configuration

Modules contribute providers through the existing Service options composition mechanism. There is no separate Search manifest section:

```jsonc
{
    "xshell": {
        "services": {
            "search": {
                "options": {
                    "providers": {
                        "catalog": {
                            "label": "Catalog",
                            "description": "Search catalog entries",
                            "icon": "catalog",
                            "implementation": "/providers/search-catalog.js",
                            "mode": "default",
                            "options": {"includeArchived": false}
                        }
                    }
                }
            }
        }
    }
}
```

Provider IDs are the keys below `providers`. `label` and `implementation` are required. `description`, `icon`, provider-specific `options`, and
`mode` are optional; omitted mode is `default`. Bootstrap normalizes a module-relative implementation path while processing the declaring module,
then ordinary manifest merging composes it into `xshell.services.search.options`.

Provider implementations follow `providers/<domain>-<provider>.js`. The directory identifies the architectural role, while the filename identifies
the domain and specialization: `providers/search-commands.js`, `providers/search-filesystems.js`, `providers/filesystem-http.js`, and
`providers/store-indexeddb.js` are representative names.

`default` providers participate in an ordinary query. `explicit` providers participate only when named in `options.providers`. Expensive remote,
content, database, semantic, or credential-sensitive discovery should normally use `explicit` so a general search does not trigger it.

## Provider implementation

A provider default-exports a class:

```javascript
export default class CatalogSearchProvider {
    constructor({catalog}, options) {
        this.catalog = catalog;
        this.options = options;
    }

    async query(text, {signal, limit}) {
        signal.throwIfAborted();
        return [{id: "products", label: "Products", href: "page:catalog:/pages/products.js"}];
    }
}
```

The Search Service loads the implementation through Resolver → Loader only when a query selects it. Construction receives a lazy dependency proxy
backed by the Search Service's owning Services context and a structured clone of the provider-specific options. Existing singleton, scoped, and
transient dependency rules therefore remain in force; Search does not implement a second dependency injection container.

One provider instance is cached by provider ID. Concurrent first queries share the same load and construction operation. Failed initialization is
removed from the cache so a later query can retry. These instances are owned by the Search singleton and are not separately registered Services.

Providers return an array of result objects without `providerId`. They should use metadata and inventory APIs that do not materialize destination
resources. A provider receives `limit` as an advisory value for relevance-aware remote or expensive retrieval and must observe `signal` itself to
interrupt domain work cooperatively. Bundled metadata providers return every matching candidate; the Search Service's aggregate limit is authoritative.

## Aggregation, cancellation, and failures

Selected providers execute concurrently. Search checks cancellation before provider initialization, before and after execution, and before
publishing the aggregate response. Provider initialization itself is not tied to one caller's signal, so cancellation of one query cannot invalidate
shared initialization required by another query. A canceled query rejects; cancellation is never converted into a provider error.

An ordinary provider failure produces a sanitized `{providerId, message}` entry while successful providers remain available. Provider stack traces,
configuration, and credentials are not returned. Invalid result shapes fail that provider rather than admitting executable or ambiguous records.

Search assigns these deterministic relevance tiers:

1. exact result ID or label;
2. label prefix;
3. label substring;
4. description or tag substring;
5. other provider-specific matches.

Within a tier, effective provider order and provider-defined result order are retained. Duplicate `(providerId, id)` identities keep their first
result. Distinct providers or distinct IDs are not merged merely because they share a label or destination. The authoritative aggregate limit is
applied only after all bundled metadata candidates are ranked and deduplicated.

## Bundled providers and UI

The `x` module contributes providers for Area navigation Pages, application module metadata, Commands, Queries, and global menu shortcuts. The Area
provider searches the current Area first and preserves friendly `path || href` destinations. The Command and Query providers use
`commands.list({query})` and `queries.list({query})` for metadata-only discovery. Activating a result opens the corresponding invocation Page in the
stack. The shortcut provider omits embedded menu entries because Search results
cannot represent `open: "embed"` or the local `outlet: "self"` composition behavior. Menu providers also omit separators, targetless groups, empty
destinations, and empty or whitespace-only labels while continuing to traverse valid descendants. Shortcut result IDs use the effective menu and
hierarchical ancestor identities, with length-prefixed components preventing ambiguous concatenation when sibling-scoped item IDs are reused.

The `x-filesystem` module contributes the Filesystems provider. It calls `filesystems.listDefinitions()` and builds Explorer links with
`named:<name>` references. It does not open Filesystem instances, connect to providers, read credential storage, or unlock Secrets.

The bundled Search Page keeps its three-character minimum as a UI policy; the Service has no minimum. The Page debounces changes, aborts the prior
request, ignores stale responses by revision, and cancels work on unload. `x-listview-item` and `x-anchor` perform navigation using each result's
`href` and `open` mode.

## Lazy-loading limits

Provider descriptors and discovery of modules, Commands, and Queries use existing configuration or generated inventories. Provider implementations load
only when selected, and explicit providers do not load during general searches. A result does not load its destination Page before activation.

Loading a default provider owned by an optional packaged module can still require that module's resources to be available. The current runtime also
loads other configured module resources eagerly during startup, so this behavior is compatible with future lazy module activation but is not a claim
that the whole application bootstrap is manifest-only or lazily activated.

See [Services](../10-architecture/100-services.md), [Areas](10-areas.md), [Commands](90-commands.md), [Queries](95-queries.md), and
[Filesystems](130-filesystems.md).
