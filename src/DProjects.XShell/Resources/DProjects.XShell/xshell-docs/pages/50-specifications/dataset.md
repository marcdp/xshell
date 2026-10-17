# DataSet JSON Specification

The canonical `xshell/schemas/dataset.schema.json` describes the JSON shape returned by XShell DataSet resource loaders.

```json
{
  "tables": [
    {
      "name": "items",
      "columns": [
        { "name": "key", "type": "string" },
        { "name": "value", "type": "string" }
      ],
      "rows": [
        { "key": "A", "value": "Active" },
        { "key": "I", "value": "Inactive" }
      ]
    }
  ]
}
```

## DataSet

A DataSet is an object with one required property:

- `tables` — a non-empty, ordered array of table objects. The first table is the default table by convention.

The schema permits no other top-level properties.

## Table

Each table requires:

- `name` — a non-empty string;
- `rows` — an ordered array of JSON objects.

`columns` is optional. When present, it is an ordered array of column metadata. A table permits no properties other than `name`, `columns`, and
`rows`. Row objects may contain arbitrary properties and values; the schema does not require every row to have every declared column, reject
undeclared properties, or coerce values.

The schema description identifies table names as unique within a DataSet, but JSON Schema validation does not enforce that uniqueness. The current
DataSet loaders do not perform a separate uniqueness check.

## Column metadata

Each column requires a non-empty `name`. It may also provide:

- `type` — optional logical metadata with one of `string`, `number`, `integer`, `boolean`, `object`, `array`, `date`, or `any`;
- `label` — a human-readable string.

Column objects permit no other properties. Column order is preserved as metadata. V0 does not use `type` to coerce or validate row values, does not
enforce column-name uniqueness, and does not require a column declaration for each row property.

## Runtime validation boundary

The schema is the canonical structural specification. The built-in `dataset-url` loader fetches and parses JSON, then validates the parsed value
against `dataset.schema.json`; invalid DataSets reject through the normal Loader error path. The `dataset-static` loader directly constructs a
DataSet using its predefined `items` table structure.

Schema validation enforces only the constraints expressed by the schema. It does not, for example, enforce uniqueness of table names or the other
V0 invariants described above that are not encoded in `dataset.schema.json`.

The returned value is a materialized JSON object. There is no DataSet class, `query()` API, relation engine, or mutation contract in V0. See
[DataSets](../10-architecture/95-datasets.md) for locators, resolution, loading, and examples.
