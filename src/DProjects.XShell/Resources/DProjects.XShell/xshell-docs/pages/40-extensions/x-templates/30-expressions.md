# XTemplate Expressions

For the normative XTemplate expression contract, see the [XTemplate Language Specification](10-specification.md). This guide summarizes the restricted,
portable expression model used by XShell.

## Current model

XTemplate expressions are a small language owned by XTemplate. The syntax is JavaScript-like, but expressions are parsed into a portable AST and
evaluated against an explicit render context. They are not arbitrary JavaScript and cannot access host globals or object methods.

Typical expression-visible identifiers include `state`, explicitly supplied application/context values, and template-defined locals. `x-for` and
`x-recursive` introduce locals such as `item`, `index`, `indexAbsolute`, and `indent`. Values such as `i18n` and `renderCount` are expression-visible
only when the rendering environment explicitly inserts them into `ExpressionContext`.

Runtime/compiler infrastructure such as `handler`, `invalidate`, `utils`, and VDOM internals is not automatically available as expression
identifiers. An implementation may expose additional identifiers only by explicitly placing them in `ExpressionContext` and documenting that
context.

```html
<h1 x-text="state.title"></h1>
<span>{{ state.message }}</span>
<li x-for="(item,index) in state.items" x-class:selected="item.id == state.selectedId">
    {{ index + 1 }}. {{ item.label }}
</li>
```

Transformers are the restricted pipeline extension:

```html
<p>{{ state.price | number(2) }}</p>
<p>{{ state.createdAt | date('dd/MM/yyyy') }}</p>
<p>{{ state.name | trim | upper }}</p>
<p>{{ state.title | slug }}</p>
<code>{{ state.value | stringify }}</code>
<code>{{ state.value | json_stringify }}</code>
<span x-text="state.json | json_parse | json_stringify"></span>
<span x-if="state.type | endsWith('_i18n')">Languages</span>
<div x-attr:data-price="state.price | number(2)"></div>
```

Transformer arguments are full XTemplate expressions, but transformer names refer only to the specified built-in language operations. General calls and
method access remain invalid: `formatPrice(state.price)`, `state.price.toFixed(2)`, and `state.name.toUpperCase()` are not XTemplate expressions.

`slug` is a pure built-in string-formatting transformer. It produces the same result regardless of the active locale.

`stringify` is the display-oriented counterpart to `json_stringify`. It takes no arguments, leaves strings unquoted, formats finite numbers and
booleans invariantly, converts null (and browser-side undefined) to an empty string, and serializes objects and arrays as compact JSON. Browser-compiled
and server-rendered XTemplates provide the same behavior for JSON-compatible XTemplate values. Cyclic structures, BigInt, functions, symbols,
non-finite numbers, and unsupported host objects are errors. Ordinary interpolation and `x-text` keep their normal text/HTML-escaping behavior;
`stringify` does not make `x-html` safe.

For example, a DataSet may contain arbitrary metadata:

```js
{
    tables: [
        {
            name: "items",
            rows: [
                { id: 1, metadata: { active: true } }
            ]
        }
    ]
}
```

After selecting the `items` rows in the template context, a cell can render that metadata without producing `[object Object]`:

```html
<td>{{ row.metadata | stringify }}</td>
```

The cell text is `{"active":true}`. Quotes, angle brackets, ampersands, and other HTML-sensitive characters in the JSON remain text rather than markup.

The transformer pipeline has lower precedence than the conditional operator. An unparenthesized pipeline transforms the complete preceding conditional,
so `state.ok ? 'yes' : 'no' | upper` means `(state.ok ? 'yes' : 'no') | upper`. Parenthesize a branch to transform only that branch. Transformer-call
parentheses establish a nested expression boundary, so full expressions such as `state.total | currency(state.code | trim | upper)` remain valid;
this does not add general function-call syntax.

`json_stringify` takes no arguments and converts a JSON-compatible XTemplate value to compact JSON. `json_parse` takes no arguments and converts a JSON
string to the corresponding XTemplate value, so parsed objects and arrays support ordinary member access, indexing, and collection operations. For
example, `{ name: "Marc", enabled: true }` becomes `{"name":"Marc","enabled":true}`, while
`state.value | json_stringify | json_parse` round-trips a JSON-compatible value. `json_stringify` is the deliberate exception to normal transformer
null propagation: it converts `null` to the string `null`; parsing the JSON string `"null"` produces the XTemplate value `null`.

## Where expressions are used

Expressions provide values for interpolation, conditional directives, bindings, loop sources, class bindings, visibility, and model binding. A
transformer pipeline can be used in ordinary value-expression positions, including bindings such as `x-attr:data-price`; `x-model` still requires an
assignable expression and therefore cannot use a transformer as its write target.

```html
<div x-if="state.visible" x-attr:title="state.title"></div>
<input x-model="state.query">
```

Event binding is different: `x-on:event="command"` identifies a named command rather than arbitrary inline JavaScript.

## Security and portability

The restricted grammar does not permit arbitrary function calls, host globals, object methods, assignments, or statements. Transformers are pure,
side-effect-free language operations: they cannot execute user code, mutate state, perform I/O, or access DOM/browser APIs. JavaScript and C#
renderers must implement the same normative transformer semantics and the profile locale behavior, including type checks, null propagation, and result
kinds.

Raw scalar conversion remains invariant. Locale-sensitive output is explicit, for example `state.price | number(2)`; ordinary `{{ state.price }}`
continues to use invariant XTemplate conversion. JavaScript and C# renderers share the `en-US`, `es-ES`, and `tr-TR` XTemplate locale
conformance profile defined by the specification. Other supported locales remain valid, but byte-for-byte equivalence can depend on compatible
host locale data outside that profile.

## Related documentation

- [X Templates](index.md)
- [XTemplate Language Specification](10-specification.md)
- [Syntax guide](20-syntax.md)
- [Compiler and runtime architecture](50-compiler.md)
