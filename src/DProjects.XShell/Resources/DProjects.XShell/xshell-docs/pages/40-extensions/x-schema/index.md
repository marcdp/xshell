# X-Schema

X-Schema is a declarative, data-aware UI format for rendering and editing structured object values in XShell. V0 is intended for CRUD and other
data-editing interfaces; it is not a general application UI language or an authoritative domain-model schema.

Retrieval and persistence remain outside X-Schema. The value may originate from a database, API, file, configuration, memory, or another source,
and the backend or domain model remains authoritative. X-Schema works independently of JSON Schema, although a JSON Schema processor could be one
possible producer of an X-Schema document.

Conceptually:

```text
structured value + X-Schema
          ↓
   x-schema-editor
          ↓
    rendered editor
```

`<x-schema-editor>` accepts the X-Schema document through its `schema` property and the structured object through its `value` property. After
validation, it renders the root type's children as DOM and XShell Web Components. Component tags are loaded through XShell's normal component
loader, `attrs` are applied as DOM attributes, and `props` are assigned through the component's public properties.

Fields bind through a component's public `value` property and `change` event. An edit mutates the corresponding location in the existing root
value and raises an editor-level `change` event with `path`, `oldValue`, `newValue`, and `value`. Objects and arrays establish recursive data
contexts; containers preserve the surrounding context. Array add, remove, and move actions use the documented creation values and X components.

The renderer implements the V0 condition model and refreshes all registered conditions after a bound value changes. A container's disabled or
readonly state is combined with each descendant field's own state. Fields without `tag` fail with a rendering error because V0 defines no fallback
component.

Local references whose source is a scoped path such as `$root.countries` are mapped to a field component's public `domain` property. Opaque
external sources such as `datasource:statuses` remain presentation-neutral unless a separate, supported source integration supplies them; X-Schema
does not invent a datasource protocol.

## Minimal example

```json
{
  "version": "0",
  "root": "Customer",
  "types": {
    "Customer": {
      "kind": "object",
      "children": [
        {
          "kind": "field",
          "bind": "name",
          "dataType": "string",
          "tag": "x-datafield",
          "props": { "label": "Name", "type": "text" }
        }
      ]
    }
  }
}
```

## Documents

- [Concepts](10-concepts.md) — The document model, element kinds, data contexts, presentation, creation values, and references.
- [V0 specification](20-specification.md) — The precise schema contract and semantic validation rules.

## Canonical resources

- [X-Schema V0 JSON Schema](../../../../x-schema/schemas/x-schema.schema.json)
- [X-Schema samples](../../../../x-schema/samples/)

## V0 boundaries

General actions, commands, menus, navigation, workflow orchestration, and general rule engines are outside V0. Component-specific validation and
behavior normally belong in component `props`; cross-field behavior is limited to the supported condition model.

## Related documentation

- [Extensions](../)
- [X Templates](../x-templates/)
