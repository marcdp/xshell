# X-Schema V0 Specification

**Document status:** X-Schema V0 format specification  
**Canonical machine-readable contract:** [X-Schema V0 JSON Schema](../../../../x-schema/schemas/x-schema.schema.json)

This document states the V0 contract and the semantic rules that cannot be expressed completely by its JSON Schema. The canonical schema is the
source of truth for document shape. Retrieval, persistence, and source-specific integration are outside this specification.

## 1. Top-level document

An X-Schema document is an object with no properties other than:

| Property | Required | Contract |
|---|---:|---|
| `version` | yes | String with the exact value `"0"`. |
| `root` | yes | Non-empty string naming the root object type. |
| `types` | yes | Object containing at least one named type. Type names must be non-empty strings. |
| `meta` | no | Object containing arbitrary extension metadata. |

`root` must refer to an existing member of `types`. JSON Schema validates its shape but cannot validate this reference; X-Schema semantic validation
must do so.

## 2. Named type definitions

Every value in `types` is an object with:

| Property | Required | Contract |
|---|---:|---|
| `kind` | yes | Exact value `"object"`. |
| `children` | yes | Array of data elements or containers. It may be empty. |
| `description` | no | String describing the type. |
| `create` | no | Object used when creating an instance of the type. |
| `meta` | no | Object containing arbitrary extension metadata. |

No other properties are allowed. In particular, occurrence-specific presentation and conditions do not belong on a named type.

## 3. Common data-element behavior

Fields, objects, and arrays are data elements. Each uses an explicit `kind`. Their optional `bind` is a non-empty path relative to the current data
context and may use `$current`, `$parent`, or `$root`. If `bind` is absent, the element operates directly on the current context value.

Each data element may have:

- `required`, a static boolean whose default is `false`;
- `description`, a string;
- `tag`, a non-empty presentation tag name;
- `attrs`, an object whose values are strings, numbers, booleans, or `null`;
- `props`, an object with arbitrary component-specific members;
- `conditions`, using the data-element condition set;
- `meta`, an object with arbitrary extension metadata.

The schema permits `tag` to be absent on a data element. V0 does not specify a fallback tag.

## 4. Field

A field is an object with `"kind": "field"`. Only the following properties are allowed:

| Property | Required | Contract |
|---|---:|---|
| `kind` | yes | Exact value `"field"`. |
| `bind` | no | Non-empty path, with the binding behavior described above. |
| `required` | no | Static boolean, defaulting to `false`. |
| `description` | no | String. |
| `dataType` | no | One of `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `time`, `object`, `array`, or `any`. |
| `tag` | no | Non-empty string. |
| `attrs` | no | Scalar-valued attributes object. |
| `props` | no | Component-specific object. |
| `default` | no | Any JSON value used when the field is otherwise uninitialized. |
| `reference` | no | Reference descriptor described below. |
| `conditions` | no | Data-element conditions. |
| `meta` | no | Arbitrary metadata object. |

A `reference` is an object with exactly three required, non-empty string properties: `source`, `key`, and `label`. `source` is an opaque locator;
`key` names the stored-value property and `label` names the human-readable property. V0 defines no source-specific retrieval protocol.

## 5. Object

An object element has `"kind": "object"` and exactly one structural form:

1. **Inline object:** it has `children` and does not have `type`.
2. **Named object:** it has `type` and does not have `children`.

`children` is an array of data elements or containers. `type` is a non-empty string and must name an existing top-level type. Existence requires
semantic validation beyond JSON Schema.

An inline object may have `create`, which must be an object used when creating that inline value. A named object reference must not have `create`;
the referenced named type owns its creation value.

In addition to `kind`, exactly one of `children` or `type`, and the common data-element properties, no properties are allowed. When `bind` is absent,
the object operates on the current data-context value.

## 6. Array

An array element requires:

- `kind`, with the exact value `"array"`;
- `item`, defining each array item.

`item` must be a data element (`field`, `object`, or `array`). A presentation-only container is not a valid array item. The array also permits the
common data-element properties and:

| Property | Required | Contract |
|---|---:|---|
| `allowAdd` | no | Boolean; default `true`. |
| `allowRemove` | no | Boolean; default `true`. |
| `allowMove` | no | Boolean; default `false`. |
| `minItems` | no | Integer greater than or equal to zero. |
| `maxItems` | no | Integer greater than or equal to zero. |
| `default` | no | Array used when the value is otherwise uninitialized. |

When `bind` is absent, the array operates on the current data-context value. `minItems` must not exceed `maxItems` when both are present; this is a
semantic validation rule because the JSON Schema does not compare their values.

## 7. Container

A container is presentation-only. It requires:

- `kind`, with the exact value `"container"`;
- `tag`, a non-empty string;
- `children`, an array of data elements or containers.

It may also have `description`, scalar-valued `attrs`, component-specific `props`, container conditions, and arbitrary object `meta`. It has no
`bind`, does not establish a data context, and cannot be `required`. Its descendants use the surrounding context.

When a container's `enabled` or `readonly` condition changes its state, that state applies to descendant editable elements. `visible` controls the
container's presentation.

## 8. Conditions

Data elements support four condition properties:

- `visible`
- `enabled`
- `readonly`
- `required`

Containers support `visible`, `enabled`, and `readonly`, but not `required`.

The V0 defaults are:

- absent `visible` means visible;
- absent `enabled` means enabled;
- absent `readonly` means not readonly;
- static `required` defaults to `false`;
- `conditions.required`, when present, overrides the element's static `required` value.

Each condition value is an atomic path condition or a logical composition.

### 8.1 Atomic path conditions

An atomic path condition contains exactly two properties: `path` and exactly one predicate. `path` is a non-empty string. Supported predicates are:

| Predicate | Value contract |
|---|---|
| `equals` | Any JSON value. |
| `exists` | The literal value `true` only. |
| `in` | A non-empty array whose entries may be any JSON values. |
| `greaterThan` | Number or string. |
| `greaterThanOrEqual` | Number or string. |
| `lessThan` | Number or string. |
| `lessThanOrEqual` | Number or string. |

For example:

```json
{ "path": "$root.status", "in": ["draft", "review"] }
```

`exists` is positive-only:

```json
{ "path": "$current.email", "exists": true }
```

Use logical `not` for non-existence:

```json
{ "not": { "path": "$current.email", "exists": true } }
```

### 8.2 Logical composition

Logical conditions have exactly one of these shapes:

```json
{ "all": [
  { "path": "$root.enabled", "equals": true },
  { "path": "$current.age", "greaterThanOrEqual": 18 }
] }
```

```json
{ "any": [
  { "path": "$current.role", "equals": "owner" },
  { "path": "$current.role", "equals": "admin" }
] }
```

```json
{ "not": { "path": "$current.archived", "equals": true } }
```

`all` and `any` arrays must each contain at least one condition. `not` contains one condition. V0 conditions do not admit arbitrary JavaScript
expressions and do not form a general assertion or rules engine.

## 9. Required semantic validation

JSON Schema validation checks document structure and property value shapes. A complete X-Schema validator must additionally enforce semantics that
the canonical JSON Schema cannot express:

- `root` must name an existing entry in `types`.
- Every object element's `type` must name an existing entry in `types`.
- `minItems` must not exceed `maxItems` when both are present.
- Recursive named-type references are valid and must not be rejected merely because they are recursive.

These rules supplement rather than replace validation against the canonical JSON Schema.

## 10. V0 non-goals

X-Schema V0 does not define:

- generic application UI, actions, commands, menus, or navigation;
- workflow orchestration or a general rule engine;
- arbitrary executable expressions;
- retrieval or persistence logic;
- database-, HTTP-, file-, or datasource-specific source mechanics;
- authoritative backend or domain validation;
- speculative V1 features.

JSON Schema is not required. A JSON Schema document or another model may produce X-Schema, but X-Schema remains an independent editor format.

## Related documentation

- [X-Schema](index.md)
- [Concepts](10-concepts.md)
- [Canonical sample directory](../../../../x-schema/samples/)
