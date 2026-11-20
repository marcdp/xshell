# Component Contract

A definition-based Component or Page declares its public contract inline in its default-exported implementation object:

```js
export default {
    contract: {
        label: "Example Component",
        tags: ["ui", "examples"],
        properties: {
            value: {
                type: "string",
                default: "",
                state: true,
                attribute: true
            }
        }
    },

    template: `<p>{{ state.value }}</p>`,

    controller({ state }) {
        return {};
    }
};
```

The Component and Page loaders validate the complete default export against `component.schema.json` or `page.schema.json`. A separate named
`contract` export is not read. A default-exported class bypasses definition processing and supplies its own registration and public API.

## Shared contract model

`contract.schema.json` defines the common contract vocabulary used by Services, Components, and Pages. Every top-level field is optional:

| Field | Shape and role |
| --- | --- |
| `label` | Human-readable contract label. |
| `description` | Human-readable explanation of the element or capability. |
| `icon` | Icon identifier or resource description. |
| `tags` | Ordered machine-readable classification identifiers. |
| `types` | Contract-local reusable named types. |
| `properties` | Public property descriptors. |
| `events` | Public events and their `detail` fields. |
| `methods` | Public methods, parameters, and return values. |
| `examples` | Optional [usage examples](#usage-examples) for documentation and tooling. |

`tags` is optional and may be empty. Each tag is a lowercase kebab-case identifier matching
`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`; duplicates are invalid and declaration order is preserved. Tags classify the contract as a whole and are
passive metadata: XShell does not infer, normalize, sort, inherit, or act on them. For Components and Pages, author them in `contract.tags`, not
`meta.tags`.

Value types are `string`, `number`, `integer`, `boolean`, `object`, `array`, `function`, `date`, and `any`. Method returns also accept
`void`. A value descriptor selects exactly one of:

- `type`, which declares an XShell value category directly; or
- `ref`, which names an entry in the same contract's `types` map.

A descriptor using `ref` cannot also declare `type` or `schema`. A direct `type` descriptor and a named type definition may add `schema`,
whose value is a JSON Schema Draft 2020-12 object or boolean. Nested object and array constraints use standard JSON Schema keywords inside
`schema`:

```js
{
    type: "object",
    schema: {
        type: "object",
        properties: {
            items: { type: "array", items: { type: "string" } }
        }
    }
}
```

A method return descriptor may also declare an optional `format`. The return `type` (or the type selected by `ref`) describes the JavaScript/XShell
value shape, while `format` describes its semantic meaning and preferred presentation. The initial standardized formats are `text`, `url`, and
`blob-url`; all require a string return value. Omitting `format` uses the default presentation for the declared type, such as structured display for
objects and arrays or scalar text for strings, numbers, integers, booleans, and dates.

```js
returns: { type: "string", format: "url", description: "Generated report URL." }
```

Return formats are descriptive metadata: the method still returns the actual value, such as the URL string, without a presentation wrapper. A
`blob-url` remains owned by the code that created it; displaying it does not revoke the object URL.

Named types are local to one contract:

```js
export default {
    contract: {
        types: {
            task: {
                type: "object",
                schema: {
                    type: "object",
                    required: ["id"],
                    properties: { id: { type: "string" } }
                }
            }
        },
        properties: {
            selectedTask: { ref: "task", readonly: true }
        },
        methods: {
            save: {
                parameters: [{ name: "task", ref: "task", required: true }],
                returns: { ref: "task" }
            }
        }
    }
};
```

The shared schema validates descriptor shape and JSON Schema placement. Service contract registration additionally verifies that every `ref` in a
property, event detail field, method parameter, or return value names a declared local type. Component and Page validation currently do
not perform that extra reference-existence pass. None of these schemas validates runtime property values, event payloads, method arguments, or
method results against `type`, `ref`, or `schema`.

## Usage examples

Components, Pages, Services, and Commands share the same example format. Declare `contract.examples` in a Component, Page, or Command
definition. In a Service contract JSON file, declare `examples` at the top level because the file itself is the contract.
The array is optional and may be empty.

| Field | Shape and role |
| --- | --- |
| `name` | Required string identifier matching `^[A-Za-z][A-Za-z0-9_-]*$`. |
| `description` | Optional string explaining the example. |
| `template` | Declarative markup or template source. When supplied, it must be a nonempty string. |
| `code` | Programmatic usage source. When supplied, it must be a nonempty string. |
| `language` | Optional nonempty language identifier, such as `javascript`, for syntax highlighting. |
| `state` | Optional object containing sample initial state or other example data. |

Each example requires `template`, `code`, or both. The schema rejects unknown fields and accepts any nonempty language identifier.

```js
contract: {
    examples: [
        {
            name: "basic",
            template: `<x-details label="Advanced options"><p>Additional content.</p></x-details>`
        },
        {
            name: "expand",
            description: "Expand the disclosure programmatically.",
            language: "javascript",
            code: `document.querySelector("x-details").expand();`
        }
    ]
}
```

Examples are passive metadata. XShell validates the fields and retains the source strings and sample data in the contract. Example rendering
and execution are unimplemented. Example `state` stays in the contract and is never merged into Component or Page runtime state.

Public reusable Components should generally include at least one example. One or two examples usually cover a simple Component. General-purpose
Components often benefit from two or three, and a complex Component may need three to five when they demonstrate distinct capabilities.
For a reusable Page, show how a caller navigates to or invokes it, including query parameters or context when they are relevant.
Examples are optional for private and internal resources. Use short, unique kebab-case names within each contract.

Use the contract for concise usage snippets, the [Component guides](index.md) for fuller explanations, and the `x-demo` Pages for interactive examples.

## Specialized contracts

Specialized schemas reuse the shared definitions and then apply element-specific rules:

- `service.schema.json` accepts the common contract surface and closes its top-level shape.
- `component.schema.json` embeds the contract in the implementation object, adds Component property metadata and `slots`, and rejects unsupported
  Component contract fields.
- `page.schema.json` embeds the contract in the Page implementation object, adds Page property metadata and `slots`, and rejects unsupported Page
  contract fields. The loader separately rejects slots reported by the selected Page render engine.
- `command.schema.json` defines the specialized Command contract with required `execute` metadata and references the shared `tags`, `types`, and `examples` fields.

Modules do not define public contracts; `module.schema.json` rejects `contract` on effective Module configurations.

## Component-specific surface

Component properties extend the common property descriptor with:

| Field | Runtime behavior |
| --- | --- |
| `attribute` | `true` observes the derived kebab-case HTML attribute. |
| `attributeParser` | Optional `"json"` parser for incoming observed attribute text. |
| `state` | `true` backs the public property with Component state. |
| `reflect` | `true` reflects property changes to the derived HTML attribute. |

The common `default` is the canonical public-property default. `required`, `readonly`, `enum`, `label`, `description`, and JSON Schema
constraints remain metadata; they do not add general assignment or presence checks. Page-only `query` and `context` metadata is not part of a
Component contract.

`contract.slots` maps public slot names to optional `description` and `required` metadata. The empty key `""` represents the default slot.
Slot metadata documents composition and is checked against render-factory slot metadata; it does not create `<slot>` elements or require
consumers to supply content.

Public methods must have same-named controller functions and cannot collide with framework or native members. Undeclared controller functions stay
private implementation behavior. Event metadata describes event names and `detail`; it does not dispatch `CustomEvent` objects or configure
`bubbles`, `composed`, or `cancelable`.

See [Properties](20-properties.md), [State](30-state.md), [Events](40-events.md), [Slots](50-slots.md),
[Pages](../10-architecture/70-pages.md), and [Services](../10-architecture/100-services.md).
