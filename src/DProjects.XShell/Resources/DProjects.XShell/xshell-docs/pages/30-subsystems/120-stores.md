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

`mem:` and named identities such as `mem:demo` use the memory provider. The configured providers cache each complete Store identity through Loader
for the application lifetime, while different identities remain isolated. The provider does not persist to browser storage.

## Provider selection

The `Stores` Service owns Store provider URL matching through `xshell.services.stores.options.providers`. These URLs are domain URLs consumed by
`stores.open(url)`, not ordinary global Resolver resources. Other modules can contribute providers through normal configuration composition:

```jsonc
{
    "xshell": {
        "services": {
            "stores": {
                "options": {
                    "providers": {
                        "remote:{identity}": {
                            "implementation": "/providers/store-remote.js",
                            "cache": true,
                            "options": {"endpoint": "https://example.test/api"}
                        }
                    }
                }
            }
        }
    }
}
```

This example describes configuration composition; `x-store` does not provide a remote implementation. The selected implementation's static
`optionsSchema` validates provider-specific `options` through `instance-js`.

```text
Stores Service
    owns Store provider URL matching

Loader
    owns materialization, caching, diagnostics, and errors

instance-js
    validates implementation options and constructs the implementation

Store implementation
    owns Store behavior and state
```

## Schema and validation

`schema.collections` is an object keyed by collection name. Each entry keeps collection metadata separate from its embedded document `schema`.
The Store metadata is validated against `x-store/schemas/store.schema.json`; documents are validated against the selected collection schema before
mutation. Failed validation leaves stored data unchanged. Returned documents are defensive copies.

The Store Explorer Page is `page:x-store:/pages/store.js`. It discovers collections and display fields from Store metadata and opens the document
editor on the Page stack. The editor uses `x-schema`; unsupported editor schema constructs are reported without changing the underlying Store.
