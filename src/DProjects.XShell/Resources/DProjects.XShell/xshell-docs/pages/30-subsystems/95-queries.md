# Queries

The application-wide `queries` service discovers and runs reusable read-only operations. Query implementations retrieve data without changing
application or business state. This is an authoring requirement because Query controllers execute ordinary JavaScript in the browser window.
[Commands](90-commands.md) execute actions through Tasks and return a Task handle. Queries return their declared result directly.
Queries are independent of UI composition, [DataSets](../10-architecture/95-datasets.md), and any presentation of their results.

## Discover Queries

The framework and each effective application module can contribute JavaScript files under `queries/`. Bootstrap registers each file as
`query:<id>`, using the path below `queries/` with the final `.js` removed. Dotted names and nested paths are preserved.
Duplicate IDs and conflicts with existing exact Query resolver entries fail during bootstrap. Modules also receive the
`query:<module-id>:<name>` convention for top-level Query names.

`queries.list(options = {})` reads the effective framework and module file inventories and returns a frozen array sorted by ID.
`queries.getInfo(id)` returns the frozen descriptor for an exact ID or `null` if it is absent. Both methods are synchronous and use inventory
metadata without importing Query implementations. Descriptors contain `id`, `moduleId`, `label`, `description`, `tags`, `category`, `icon`,
`path`, and `size`. Tags are frozen, with an empty array for omitted tags. Missing descriptive strings are empty, and the default category
is the owning module ID. The optional `moduleId` and `category` filters match exactly. The `query` filter matches a case-insensitive substring
of an ID, label, description, or tag.

```js
const available = queries.list({moduleId: "x-demo", query: "inventory"});
const descriptor = queries.getInfo("demo.inventory.count");
```

Open **Queries** in Diagnostics to filter the inventory, or find Queries through the default providers in [Search](140-search.md). Activate a result
to open its invocation form in the stack. The form accepts named arguments and displays the returned value.

## Define a Query

Default-export a static definition object with an inline `contract`, a `contract.query` method declaration with required `returns`, and a
controller factory that produces an object with a callable `query()` method. The service awaits both the factory and the operation.

```js
// queries/sales.total.js
export default {
    contract: {
        label: "Sales total",
        description: "Returns the total for a sales region.",
        tags: ["sales"],
        query: {
            parameters: [{name: "region", type: "string", default: "all", enum: ["all", "north", "south"]}],
            returns: {type: "number", schema: {minimum: 0}}
        }
    },

    controller({sales}) {
        return {
            async query(region) {
                // Retrieve an aggregate from the application's sales service.
                return await sales.getTotal(region);
            }
        };
    }
};
```

Parameters and returns use the [shared contract vocabulary](../20-components/10-manifest.md). Use `type` and optional JSON Schema constraints
or a `ref` to a named type in `contract.types`. Use `{type: "any", schema: {type: "null"}}` for a null result or use `anyOf` for nullable
results. A Query can return primitives, objects, arrays, or any other value allowed by its declared contract. Query contracts also support
`contract.examples`. The server generates descriptive metadata from static literals in the contract, and the Query loader validates and freezes
the definition at load time.

## Run a Query

Resolve the singleton through `services.resolve("queries")` or inject `queries` into a controller. The cookbook **Advanced / Queries** Page
demonstrates numeric, array, object, and null results with `demo.inventory.count`, `demo.inventory.list`, and `demo.inventory.detail`.

```js
const count = await queries.run({id: "demo.inventory.count", args: {minimumStock: 5}});
const product = await queries.run({id: "demo.inventory.detail", args: {sku: "NOTE-01"}});
```

`run({id, args = {}})` resolves `query:<id>` through the ordinary Resolver → Loader pipeline. It rejects unknown arguments and duplicate
parameter names, clones defaults for omitted arguments, passes `undefined` for omitted optional parameters without defaults, and validates
supplied and defaulted values before passing positional arguments in declaration order. It awaits the controller and validates the result
before returning the original value.

Each call constructs a new invocation with an independent direct child of the application's root [Services](../10-architecture/100-services.md)
scope. The controller can inject the frozen `definition`, an invocation `context` containing `id`, the owning `module` and `moduleConfig`
for module contributions, and its owning `services` scope. Ordinary dependencies resolve through that scope. Singletons are shared, scoped
instances are reused within one invocation, and transients are created per resolution.

The returned Promise settles after scope disposal, including if controller creation, execution, or result validation fails.
When both execution and disposal fail, the Promise rejects with an `AggregateError` containing both errors in that order.
The Loader can cache the Query class. Each call executes a fresh invocation.
