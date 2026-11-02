# Component State

State is instance-owned implementation data. Public properties are a separate API even when explicitly backed by state.

## Defaults and initialization

The loader builds one skeleton from private `definition.state` entries and defaults of `contract.properties` with `state: true`.
Public defaults always come from `contract.properties[*].default`. A state-backed public name may also appear in `definition.state` only with a
structurally equal value, including nested arrays/objects. The loader checks equality and retains the contract default.
A non-state-backed public property cannot appear in implementation state.

State entries are ordinary values, not descriptors with `type`, `attr`, `prop`, or `reflect` flags. Public-property behavior belongs to the contract.

```js
export default {
    contract: {
        properties: { count: { type: "integer", default: 0, state: true } }
    },
    template: '<span x-text="state.count"></span>',
    state: { busy: false },
    controller({ state }) {
        return { increment() { state.count += 1; } };
    }
};
```

For Pages, query-enabled values are initialized before controller construction; context-enabled values are copied afterwards and may override
query values. See [Pages](../10-architecture/70-pages.md).

## Engine selection

Resource `meta.stateEngine` overrides the owning module's `defaults.component.stateEngine` or `defaults.page.stateEngine`.
There is no engine fallback under `xshell.ui`.

| Engine | Implemented behavior |
| --- | --- |
| `none` | Returns `null`; use only definitions without state access, state-backed properties, or Page query/context writes. |
| `plain` | Returns a JSON-cloned skeleton; mutations do not notify or invalidate rendering. |
| `proxy` | Returns a JSON-cloned skeleton behind a Proxy; observes top-level assignment and notifies the loader. |

JSON cloning does not preserve functions, prototypes, Date instances, or undefined members and rejects cycles.
Non-state-backed Component properties are stored separately; structured array and plain-object defaults are instantiated independently by the Component loader,
not cloned by the state engine.

## Proxy changes

`proxy` observes `state.name = value`, not `state.item.label = value` or `state.items.push(value)`.
Assign a fresh object or array to make a change observable:

```js
state.items = [...state.items, newItem];
state.item = { ...state.item, label: "Updated" };
```

By default, change detection retains the engine's existing assignment comparison. A state-backed Component property can opt into
`changeDetection: "structural"`; the engine then compares each root assignment with an independent snapshot and can detect object or array changes
made in place since the previous assignment. Equal contents do not notify. Nested mutation alone still does not notify: the root property must be
assigned again. This is snapshot comparison at assignment time, not deep reactivity.

The engine exposes `addEventListener("change:<property>", listener)` and corresponding removal.
Listeners receive `{ prop, newValue, oldValue }`. A detected assignment invokes the loader's change handler and invalidation callback.
The loader batches `stateChange` and rendering through `requestAnimationFrame`; reflected state properties depend on these notifications.

## State-engine boundary

The engine owns state creation, change detection, notification, and invalidation. It does not own contracts, public API, controllers, lifecycle,
rendering, or navigation. The loader coordinates engines, lifecycle, and queued commands.

See [Properties](20-properties.md), [Lifecycle](60-lifecycle.md), [Rendering Engines](70-rendering.md), and [ADR-0004](../60-adr/0004-properties-and-state.md).

## Working example

When the host application registers the optional `x-demo` module, `page:x-demo:/pages/02-pages/04-state.js` demonstrates private Page state,
controller mutations, derived values, and conditional rendering. The locator is a Loader input, not a browser-facing navigation URL.
