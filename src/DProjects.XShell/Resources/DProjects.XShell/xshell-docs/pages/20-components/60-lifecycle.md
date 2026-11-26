# Component Lifecycle

This document outlines the lifecycle implemented by the JavaScript component loader.

## Ownership boundaries

For definition-based Components and Pages, the loader owns the runtime composition and lifecycle:

```text
loader
 ├─ contract / properties / public API
 ├─ controller / lifecycle
 ├─ state engine → reactive state
 └─ render engine → rendered output
```

State engines own reactive state only. Render engines own rendered output only. The loader creates and coordinates both engines; it owns `load`,
`mount`, `unmount`, and `unload`, controller methods, public methods, contracts, property and attribute semantics, and service access. Page hosts and
Navigation own navigation-specific orchestration.

## Definition loading

The loader imports and validates the contract/implementation, prepares style and the state/render factories, validates factory-reported slots,
loads dependencies, initializes the render factory, and defines the custom element. State/controller instances are created on element construction.

Definition styles are processed once while the Component or Page class is created. Relative CSS URLs use the definition resource as their base;
recursive `@import` URLs use each imported stylesheet as their base. Page CSS is scoped after imports are expanded. Each Page mount creates its own
scoped stylesheet and removes it on unmount.
Before a Component's processed definition sheet, its Shadow Root adopts the constructable sheets contributed by every module
`styles/shared.css`, in effective module order. Those shared objects are loaded once and reused across Component instances and nested Component
Shadow Roots. The main document adopts those same objects before module `styles/index.css` sheets. Shared sheets provide visual defaults rather
than browser normalization; the document reset stays in `index.css`, does not cross shadow boundaries, and Components own any normalization their
internal implementation requires. The native `x-page` Shadow Root uses the same ordered shared collection before its own local layout sheet;
definition-based Page styles retain their existing scoped mount/unmount ownership instead of becoming Shadow Root sheets. Document custom
properties and other inherited values continue through hosts, but ordinary document selectors cannot style internal shadow content. Shared rules
likewise do not enter third-party Web Components; cross-boundary styling remains limited to supported custom properties, `::part`, and direct
`::slotted` content.
Runtime CSS and template resource references use relative or module-root paths, or standard URI schemes. `app:` and `url:` are
configuration/bootstrap-only and are rejected in runtime CSS and templates. Custom resources without a module path resolve relative and
origin-root URLs against their declaring URL.

## Construction and loading

Construction creates a shadow root, creates state through the state engine, exposes selected services to the controller, retains its returned
named handlers privately, and invokes the `load` handler. Every controller handler runs with the controller object as `this`. The generated Web
Component is available only through the explicitly requested `host` dependency, so DOM access uses forms such as `host.dispatchEvent(...)` and
`host.shadowRoot`. Lifecycle handlers remain private controller methods rather than public Web Component methods.

Definition-based Components can set `meta.awaitLoad: true` when their first render depends on initialization performed by `load`. Its default is
`false`, which preserves the ordinary lifecycle: an asynchronous `load` can continue after the Component mounts and renders. With
`awaitLoad: true`, the loader accepts either a synchronous or asynchronous handler and delays the initial mount and render until it completes successfully.
State invalidations during that wait are retained without rendering, so the first render observes the initialized state.
Native Web Component classes supplied directly by a module keep their independently implemented lifecycle and are unaffected by this metadata.

```javascript
export default {
    meta: {
        awaitLoad: true
    },

    state: {
        ready: false
    },

    controller({ state, preferences }) {
        return {
            async load() {
                // Initialize state before rendering.
                state.ready = await preferences.get("ready") ?? false;
            }
        };
    }
};
```

Use this option only when initialization must complete before the first render. If the Component disconnects while waiting, completion does not
mount it; a later reconnection mounts the same initialized instance without invoking `load` again. Unloading permanently prevents a pending
continuation from mounting. A rejected awaited `load` is reported as a Component load failure and prevents mounting, while explicit unloading and
cleanup remain available.

## Mount and render

On connection, the loader creates and mounts a render-engine instance, invokes `mount`, and schedules a render. State invalidations are coalesced
through `requestAnimationFrame`; immediately before rendering, the loader invokes `stateChange` with accumulated changes.

## Instance and connection lifetimes

Component and Page lifecycle handlers have two different ownership scopes:

```text
instance creation
    load

connection #1
    mount
    unmount

connection #2
    mount
    unmount

...

final destruction
    unload
```

`load` and `unload` each run once for an instance. `mount` runs whenever that instance becomes connected or mounted, and `unmount` runs whenever
it becomes disconnected or unmounted. In particular, a native `disconnectedCallback()` is not evidence of permanent destruction: the browser can
reconnect the same custom-element instance later.

Keyed XTemplate reordering uses `ParentNode.moveBefore()` when the browser provides it. Definition-based Components and `x-page` implement an
empty `connectedMoveCallback()`, so these same-tree moves keep the current render engine, state engine, subscriptions, and Page mount intact. The
`insertBefore()` compatibility fallback still preserves the element object, but browsers can run the ordinary disconnect/reconnect lifecycle for
that fallback.

The controller context is stable across these calls. A lifecycle handler can use `this.refresh()` to invoke another controller method, while an
operation on the underlying custom element must use the injected `host`.

The runtime keeps controller, state, and the owner Services scope for the complete `load` → `unload` lifetime. Transient `Timer` and `Events`
instances are owned by that scope. Render-engine instances and page-specific adopted stylesheets are mount-owned resources; they are
created/adopted for `mount` and unmounted/de-adopted for `unmount`.

For definition-based components, ordinary DOM disconnection invokes only `unmount`; it does not invoke `unload` or dispose helpers. The browser
custom-element API has no reliable universal signal that distinguishes a temporary disconnection from permanent destruction.

When an XShell render engine permanently discards renderer-owned DOM, it initiates `unload()` for definition-based Components in the discarded
light-DOM subtree before removing or replacing those nodes. The walk does not traverse Component shadow roots externally: unloading a Component
tears down its own render engine, which finalizes the renderer-owned descendants in that shadow tree. Code outside these owned destruction paths
that permanently destroys a Component remains responsible for calling its idempotent `unload()` method.

For Pages, `x-page` unmounts its current Page when disconnected and remounts the same Page on reconnection. Replacing a Page, or using the
explicit `removePage()` destruction path, unmounts the old Page and then unloads it before discarding the instance. `unload()` is idempotent as a
safety measure, but lifecycle owners should not use it as normal replacement control flow.
During navigation, the load operation owns each candidate Page until the serialized transition assigns it to `x-page`. A candidate that fails
preparation, becomes stale, or cannot complete the pre-adoption transition is unloaded before the failure returns; assignment transfers final
cleanup responsibility to the ordinary `x-page` lifecycle.
Closing a dialog uses `removePage()`: its Page unmounts and unloads before the dialog host is removed and the result promise completes.

Invalidation is also mount-scoped. Requests made before mount or after unmount do not render, and an animation-frame callback queued for a prior
render engine is ignored once that engine has been unmounted or replaced.

## Related documentation

- [Components](index.md)
- [State](30-state.md)
- [Loaders](../10-architecture/90-loaders.md)

## Awaiting handlers

Component construction ordinarily invokes `load` without awaiting its result. A definition-based Component with `meta.awaitLoad: true` instead
uses the handler's completion as a barrier before its first mount and render. Connection/disconnection still invoke `mount`/`unmount` synchronously.
Explicit Component `unload()` awaits its handler and disposes helpers in a final cleanup path.
If the Component is still mounted, it first runs `unmount` and tears down the render engine. Final helper disposal still runs if either lifecycle handler fails.
Page `load`, `mount`, `unmount`, and `unload` use asynchronous lifecycle methods that await their handlers.
Use the host's Page load sequence when completion matters.

See [Dialogs](../30-subsystems/30-dialogs.md) for dialog final destruction and result handling.
