# Stores

The optional `x-store` module defines a provider-independent interface for named collections of JSON documents. A Store exposes `schema` metadata
and the asynchronous `get`, `list`, `add`, `save`, and `remove` operations. Documents use a string `id` property as their collection-local identity.

Open a Store through the `Stores` Service:

```js
const store = await stores.open("mem:demo");
const customers = await store.list("customers");
const customer = await store.add("customers", {name: "New customer", email: "customer@example.test"});
await store.save("customers", {...customer, name: "Updated customer"});
await store.remove("customers", customer.id);
```

`mem:` and named identities such as `mem:demo` use the memory provider. The `Stores` Service caches each configured Store identity for the
application lifetime, while different identities remain isolated. The provider does not persist to browser storage.

## Provider selection

The `Stores` Service owns Store provider URL matching through `xshell.services.stores.options.providers`. These URLs are domain URLs consumed by
`stores.open(url)`, not ordinary global Resolver resources. Provider entries are keyed by URL scheme without the trailing colon; `remote` therefore
handles identities such as `remote:customers`. Other modules can contribute providers through normal configuration composition:

```jsonc
{
    "xshell": {
        "services": {
            "stores": {
                "options": {
                    "providers": {
                        "remote": {
                            "implementation": "/providers/store-remote.js",
                            "options": {"endpoint": "https://example.test/api"}
                        }
                    }
                }
            }
        }
    }
}
```

This example describes configuration composition; `x-store` does not provide a remote implementation. `Stores` requires the selected
implementation's static `optionsSchema` and validates a cloned provider-specific `options` object before construction.

```text
Stores Service
    owns Store provider scheme dispatch and caching
    ↓
configured implementation URL
    ↓
provider implementation import
    ↓
optionsSchema validation
    ↓
new Implementation(injectedServices, options)

Store implementation
    owns Store behavior and state
```

The runtime `url` is added after authored options validation and wins over a conflicting authored value. Provider dependencies resolve lazily
through the owning Services context. Store providers are not global Resolver resources or Loader resources, so their construction produces no
Loader registry entries or generic Loader events.

A provider opts into instance reuse with an optional static `getCacheKey(url)` method. Returning a nonempty string selects the provider-defined
cache identity; returning `null`, or omitting the method, creates a new instance for every `open()`. Stores owns in-flight sharing and failed-entry
eviction, while the implementation owns the semantic identity. The memory Store returns its complete URL so each identity is cached independently.

## Schema and validation

`schema.collections` is an object keyed by collection name. Each entry keeps collection metadata separate from its embedded document `schema`.
The Store metadata is validated against `x-store/schemas/store.schema.json`; documents are validated against the selected collection schema before
mutation. Failed validation leaves stored data unchanged. Returned documents are defensive copies.

The Store Explorer Page is `page:x-store:/pages/store.js`. It discovers collections and display fields from Store metadata and opens the document
editor on the Page stack. The editor uses `x-schema`; unsupported editor schema constructs are reported without changing the underlying Store.

## Search

Use `store:` followed by a collection name, label, or description, for example `store: customers`. Results open the Store Explorer with the
matching collection selected. The Search provider reads collection metadata from the Store URLs configured in
`xshell.services.search.options.providers.stores.options.sources`. The bundled configuration searches `mem:`. Store documents are loaded
when the Explorer opens the selected collection.
