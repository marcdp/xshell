# X-Schema Concepts

X-Schema describes how an editor presents and edits a structured value. It carries the data characteristics needed to construct that editor, but it
does not replace the authoritative backend or domain model.

## Document structure

An X-Schema V0 document has four top-level members:

- `version` identifies the format version and is `"0"`.
- `root` names the reusable object type that starts the editor.
- `types` contains named reusable or recursive object editor structures.
- `meta`, when present, carries extension metadata.

`root` is a name, not an inline element. It must identify one entry in `types`.

## Element kinds

Every element has an explicit `kind` discriminator where the schema defines one. V0 has four element kinds:

- `field` edits an atomic value.
- `object` edits an object value.
- `array` edits an ordered collection of data values.
- `container` groups elements for presentation.

Fields, objects, and arrays are **data elements**. A container is **presentation-only**: it neither binds a value nor creates a data context. Named
types also explicitly use `"kind": "object"`.

## Named types and objects

The top-level `types` registry defines reusable object structures. For example:

```json
{
  "Address": {
    "kind": "object",
    "children": [
      { "kind": "field", "bind": "city", "dataType": "string" }
    ]
  }
}
```

An object element either defines its `children` inline or refers to a named type through `type`. It must not do both:

```json
{
  "kind": "object",
  "type": "Address",
  "bind": "billingAddress"
}
```

Multiple object elements may reuse the same named structure. A type may also refer, directly or indirectly, to itself, allowing recursive editor
structures. A named reference selects structure; presentation and behavior for that occurrence stay on the referring object element.

## Binding and data context

`bind` is a path relative to the current data context. Scoped paths may use:

- `$current` for the current context;
- `$parent` for its parent context;
- `$root` for the root value.

When a data element omits `bind`, it operates directly on the current data-context value. This is useful, for example, when an array item is itself a
field or object. An object or array element establishes the context in which its nested data is edited. Containers do not establish a new context,
so their descendants continue to use the surrounding context.

The schema defines the available scoped path names but does not define a more elaborate path language or arbitrary executable expressions.

## Presentation

Data elements may specify presentation through:

- `tag`, the element name to render;
- `attrs`, scalar DOM-style attributes;
- `props`, component-specific configuration.

Containers require `tag`; fields, objects, and arrays may omit it. The schema does not define a fallback tag for an omitted data-element `tag`, and
this documentation does not infer one from component conventions. `attrs` values are limited to strings, numbers, booleans, or `null`, while
`props` may contain component-specific JSON data.

These members configure the editor presentation. They do not define the authoritative domain model. Component-specific behavior and validation
should normally remain in `props` rather than becoming new X-Schema concepts.

## Value creation and defaults

X-Schema can describe editor-side initialization:

- `field.default` supplies any JSON value when a field has not otherwise been initialized.
- `array.default` supplies an array value for an uninitialized array.
- `object.create` supplies an object used when creating an inline object.
- a named type's `create` supplies an object used when creating an instance of that type.

These are editor initialization and creation values. They are not backend defaults and do not override server-side or domain rules. A named object
reference cannot define `create` on the reference itself; creation for that structure belongs to the named type.

## References and data sources

A field can describe a referenced choice with three strings:

```json
{
  "reference": {
    "source": "$root.countries",
    "key": "id",
    "label": "name"
  }
}
```

`source` is an opaque locator. X-Schema does not decide whether it resolves to local data, HTTP data, a database-backed source, a file, an XShell
datasource, or something else. `$root.countries` is a valid local-source style. Other registered forms, such as `datasource:countries`, may be used
when the consuming XShell environment supports them; V0 does not specify a datasource runtime protocol.

`key` identifies the source-item property whose value is stored by the field, and `label` identifies the property presented to the user.

## Separation of responsibilities

X-Schema V0 describes CRUD-oriented editor structure. It does not define retrieval, persistence, general actions, commands, menus, navigation,
workflow orchestration, arbitrary JavaScript expressions, or a general validation and rule engine. See the [V0 specification](20-specification.md)
for the exact contract and supported conditions.

## Related documentation

- [X-Schema](index.md)
- [V0 specification](20-specification.md)
