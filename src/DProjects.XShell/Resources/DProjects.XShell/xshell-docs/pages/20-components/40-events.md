# Component Events

Components emit standard DOM CustomEvents. Inline `contract.events` metadata describes public events and their `detail` fields but does not emit
them or validate payload values. Each detail field uses a direct `type` or contract-local `ref` and may add `description`, `schema`, and
`required`. Flags such as `bubbles`, `composed`, and `cancelable` are not contract fields and must be set by the implementation:

```js
export default {
    contract: {
        events: {
            change: {
                description: "Raised when the value changes.",
                detail: {
                    value: { type: "string", required: true }
                }
            }
        }
    },
    controller({ host }) {
        return {
            changed(value) {
                host.dispatchEvent(new CustomEvent("change", {
                    detail: { value }, bubbles: true, composed: true
                }));
            }
        };
    }
};
```

DOM events propagate according to those flags. [Bus events](../30-subsystems/20-bus.md) are asynchronous application messages delivered to listeners.
Component/module event declarations do not automatically dispatch either kind.

## Optional X Templates integration

`x-on:<event>` forwards a command name and browser event to a private controller handler.
`x-on:click.prevent="save"` invokes `save(event)`; declaring it in `contract.methods` is unnecessary.
The `@event` shorthand is not supported.

The current renderer recognizes:

- `stop`, `prevent` for propagation/default handling after dispatch;
- `left`, `middle`, `right` for mouse buttons;
- `alt`, `shift`, `ctrl` for modifier-key requirements;
- `escape`, `enter`, `tab`, `backspace`, `delete`, `space`, `up`, `down`, `left`, `right` for keyboard filtering;
- native listener options `once`, `capture`, `passive`, passed through the listener options object.

Unknown flags have no defined X Template behavior. There are no `self`, `meta`, or `exact` filters.
Current mouse filtering also applies to keyboard events: `.left`/`.right` fail for ordinary key events because `event.button` is absent.
`.up`/`.down` have no such conflict. `passive.prevent` cannot override browser passive-listener rules.

See [X Template Bindings](../40-extensions/x-templates/40-bindings.md) and the
[modifier specification](../40-extensions/x-templates/10-specification.md#25-event-modifiers) for syntax and dispatch details.
