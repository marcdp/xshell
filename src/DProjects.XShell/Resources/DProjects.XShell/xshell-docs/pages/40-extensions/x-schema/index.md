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

`<x-schema-editor>` accepts the X-Schema document through its `schema` property and the structured object through its `value` property. Its current
repository implementation exposes this contract, but rendering behavior is still a placeholder; the format contract is defined by the canonical
schema rather than by inferred editor behavior.

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
