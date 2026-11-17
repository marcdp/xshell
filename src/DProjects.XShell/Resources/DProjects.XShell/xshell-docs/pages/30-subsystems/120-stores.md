# Stores

The optional `x-store` module defines a provider-independent interface for named collections of JSON documents. A Store exposes `schema` metadata
and the asynchronous `get`, `list`, `add`, `save`, and `remove` operations. Documents use a string `id` property as their collection-local identity.

Load providers through the ordinary Resolver and Loader pipeline:

```js
const store = await loader.load("store:mem:demo");
const customers = await store.list("customers");
const customer = await store.add("customers", {name: "New customer", email: "customer@example.test"});
await store.save("customers", {...customer, name: "Updated customer"});
await store.remove("customers", customer.id);
```

`store:mem:` and named identities such as `store:mem:demo` use the memory provider. The resolver caches each complete resource identity for the
application lifetime, while different identities remain isolated. The provider does not persist to browser storage.

## Schema and validation

`schema.collections` is an object keyed by collection name. Each entry keeps collection metadata separate from its embedded document `schema`.
The Store metadata is validated against `x-store/schemas/store.schema.json`; documents are validated against the selected collection schema before
mutation. Failed validation leaves stored data unchanged. Returned documents are defensive copies.

The Store Explorer Page is `page:x-store:/pages/store.js`. It discovers collections and display fields from Store metadata and opens the document
editor on the Page stack. The editor uses `x-schema`; unsupported editor schema constructs are reported without changing the underlying Store.
