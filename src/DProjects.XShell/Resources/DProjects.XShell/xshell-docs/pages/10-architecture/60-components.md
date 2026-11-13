# Components

XShell uses browser Web Components as its component boundary. A component JavaScript module default-exports either a custom-element class or a
definition object. The class form owns its implementation directly; the definition form lets XShell construct and register the final class.

This page describes ownership and loading. The [Component guides](../20-components/) are authoritative for the contract, properties, state, events,
slots, lifecycle, rendering, forms, and list behavior.

## Component as a class

A default-exported Web Component class bypasses definition processing:

```js
export default class ExampleElement extends HTMLElement {
    connectedCallback() {
        this.textContent = "Example";
    }
}
```

The module remains loadable through the `component-js` loader, but the class owns registration behavior, public API, state, rendering, and lifecycle.
The inline definition contract and engine model described below do not apply.

## Component as a definition

A definition-based Component keeps public API metadata and runtime implementation in one default-exported object while preserving their distinct
roles:

```js
export default {
    contract: {
        properties: {
            label: { type: "string", default: "Example", attribute: true, state: true }
        },
        methods: {
            reset: { description: "Reset the component." }
        }
    },

    state: { count: 0 },
    template: `<button x-on:click="increment">{{ state.label }}: {{ state.count }}</button>`,

    controller({ state }) {
        return {
            increment() { state.count++; },
            reset() { state.count = 0; }
        };
    }
};
```

The optional inline `contract` describes public API. The remaining fields provide implementation metadata, dependencies, style, template/rendering,
private state, and controller behavior. A separate named `export const contract` is not an input to the current Component or Page loaders.

## Contract

The shared contract vocabulary is defined by `xshell/schemas/contract.schema.json`. Complete definition objects are validated against
`component.schema.json` or `page.schema.json`; those schemas specialize the shared vocabulary for their resource types.

Properties are public API and state is private implementation data. A property participates in state only when it declares `state: true`. Controller
methods remain private unless the contract declares a same-named public method. Slot metadata documents and validates composition; it does not create
`<slot>` elements. Contract event metadata does not itself dispatch events, and descriptive type metadata does not generally validate runtime values.

See [Component Contract](../20-components/10-manifest.md) for supported fields and enforcement boundaries, then [Properties](../20-components/20-properties.md),
[State](../20-components/30-state.md), [Events](../20-components/40-events.md), and [Slots](../20-components/50-slots.md).

## Implementation

Definition fields include `meta`, `dependencies`, `style`, `template`, compiler-generated `templateRenderer`, `state`, and `controller`. The loader
derives missing resource metadata where documented, selects engines from resource `meta` and the owning module's defaults, and passes implementation
services to the controller. Implementation fields do not become public API merely because they exist on the definition or controller.

## Declarative dependencies

`dependencies` requests resources needed before the Component class is constructed:

```js
export default {
    dependencies: {
        helper: "esm:/utils/helper.js",
        editor: "component:x-code-editor"
    },

    controller({ dependencies }) {
        return { load() { dependencies.helper.initialize(); } };
    }
};
```

Each value follows the normal [Resolver](80-resolvers.md) -> [Loader](90-loaders.md) pipeline. All declared resources settle before class construction;
failed resolution or loading rejects the Component load. This is declarative resource loading, not a separate dependency-injection framework.
Controllers can still use the Loader service for resources selected dynamically at runtime.

## Component loader

The `component-js` loader:

1. imports the module and returns a default-exported class unchanged;
2. otherwise normalizes and validates the complete definition and inline contract;
3. selects state and render engines, creates the render factory, and validates factory-reported slots;
4. loads render-factory and implementation dependencies;
5. constructs and registers an `HTMLElement` subclass with declared public properties and method proxies; and
6. coordinates controller creation, connection lifecycle, state changes, and rendering for each instance.

Generic contract, controller, lifecycle, and public-API responsibilities remain in the loader. State engines own reactive state; render engines own
rendered output. See [Lifecycle](../20-components/60-lifecycle.md) and [Rendering Engines](../20-components/70-rendering.md).

## Containing Page lookup

A definition-based Component can request the injected `getPage` service. It walks ordinary parents and Shadow DOM hosts to find the closest
`<x-page>`, then returns that host's current Page or `null`. A Page might not yet exist during Component `mount()`, so callers must handle `null`.
This lookup does not merge the Component and Page runtime models; Page navigation remains a Page responsibility.

### `getPage()`

```js
controller({ getPage }) {
    return {
        mount() {
            const page = getPage();
            if (!page) return;
            // use the containing Page
        }
    };
}
```

## Controller and Web Component ownership

The generated Web Component owns browser integration, its public contract surface, Shadow DOM, and framework lifecycle plumbing. The controller owns
implementation behavior, private methods, lifecycle handlers, and template handlers. Controller methods execute with the controller as `this`; code
that needs the generated element requests the injected `host` value. Only names in `contract.methods` are proxied onto the element.

Controllers can request `postRender`, a function that queues a local controller method by name and optional arguments for FIFO execution after the
next render. Calling `postRender(methodName, ...args)` does not schedule a render; it only adds work to the Component instance's post-render queue.

## State and rendering

A definition resolves `renderEngine` and `stateEngine` from its `meta` overrides and then its owning module's `defaults.component`. Page definitions
use the parallel `defaults.page` group. These module defaults are not the same as global `xshell.ui` resources, which select application UI
infrastructure such as layouts, lazy/error components, Markdown presentation, and dialogs.

X Templates are one optional render-engine extension; they are not the Component model itself. See [X Templates](../40-extensions/x-templates/).

## Component resources

Modules normally expose Components from `components/`. Bootstrap uses resolved file inventories to create conventional Component resolver entries, so
a logical reference such as `component:module1-button` can resolve to the owning module's JavaScript resource. Dynamic runtime resources must not be
classified as unused solely from static imports.

## Summary

```text
component module
    -> default-exported Web Component class
    or
    -> default-exported definition with optional inline contract
       -> component-js loader
       -> registered Web Component class
```

The contract and implementation share an object but remain separate concepts. Resolver selection, loader orchestration, state behavior, rendering,
and navigation retain distinct responsibilities.

## List data-field item defaults

`x-datafield type="list"` accepts `itemDefault`; each Add action deep-clones the supplied object, or appends `{}` when it is absent. Define every
property used by item-level strict `x-model` bindings because those bindings do not create missing members. Detailed list composition and examples
belong in the [List View guide](../20-components/90-listview.md).

## Markdown component inputs

`x-markdown` renders trusted Markdown and does not sanitize generated HTML. `value` accepts trusted text; `src` is fetched as a normal browser URL and
becomes the base for relative document resources. Applications must sanitize untrusted content before rendering it. Page adaptation, navigation, and
URL behavior are documented under [Markdown Pages](70-pages.md#markdown-pages).

## Related documentation

- [Component guides](../20-components/)
- [Pages](70-pages.md)
- [Resolvers](80-resolvers.md)
- [Loaders](90-loaders.md)
- [X Templates](../40-extensions/x-templates/)
