# Form Validation

XShell separates single-field validation, form-level assertions, and form coordination:

- `x-datafield` validates one field or value, including required, minimum, maximum, pattern, and type constraints.
- `x-form-assert` validates relationships between values or other business rules that do not naturally belong to one field.
- `x-form` aggregates errors from both components and controls submission.

## Form assertions

`x-form-assert` receives a boolean result through its `test` property. Expression evaluation and reactive property binding belong to
[X Templates](../40-extensions/x-templates/40-bindings.md); the assertion itself only validates the resulting boolean.

```text
test = true   assertion passes; no validation error
test = false  assertion fails; one validation error
```

Use an assertion for cross-field constraints such as a minimum that must not exceed a maximum:

```html
<x-form>
    <x-datafield type="number" label="Minimum" x-model="state.min"></x-datafield>
    <x-datafield type="number" label="Maximum" x-model="state.max"></x-datafield>

    <x-form-assert
        x-prop:test="state.min <= state.max"
        label="Range">
        Minimum must be less than or equal to maximum.
    </x-form-assert>
</x-form>
```

The `message` property can supply the validation text instead of default-slot content:

```html
<x-form-assert
    x-prop:test="state.start <= state.end"
    label="Dates"
    path="Schedule"
    message="End must be greater than or equal to start.">
</x-form-assert>
```

## Validation lifecycle

An assertion does not initially show an error. Calling `validate()` marks it as validated. A failed assertion then returns one error and may show
its lightweight inline error; a passing assertion returns an empty array and does not show the inline error. `x-form` includes assertion errors in
its form-level error summary.

An `assert:change` event does not force validation before the form has been validated. After the first form validation, the same event causes
`x-form` to validate again so its summary and submission state stay current. Wizard forms aggregate only fields and assertions in the current
wizard panel.

Submission proceeds only when the combined `x-datafield` and `x-form-assert` result contains no errors.

## Public API

### Properties

| Property | Type | Default | Purpose |
| --- | --- | --- | --- |
| `test` | boolean | `true` | Condition that must be true for the assertion to pass. |
| `label` | string | `""` | Optional label included in the validation error. |
| `path` | string | `""` | Optional path included in the validation error. |
| `message` | string | `""` | Validation text; when empty, trimmed default-slot text is used. |

### Method

`validate()` marks the assertion as validated and returns either `[]` or an array containing one error with `type`, `label`, `path`, and `message`.

### Event

`assert:change` is emitted when `test` changes semantically. It bubbles, is not composed across shadow boundaries, and has this detail:

```js
{
    oldValue: boolean,
    newValue: boolean
}
```

### Slot

The default slot supplies fallback validation text when `message` is empty.
