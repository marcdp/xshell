
export default {
    meta: {
        title: "Transformers",
        description: "Demonstrates X Template transformer pipelines for strings, numbers, dates, and JSON values."
    },

    template: `
        <p>Transformers format or convert values directly in X Template expressions. Use the pipe operator <code>|</code> to pass a value through a transformer. Multiple transformers execute from left to right.</p>

        <h2>String transformers</h2>
        <p>Change the text to observe how each transformer processes the same value.</p>
        <x-datafield type="text" label="Text" x-model="state.name"></x-datafield>
        <x-datafields columns="2">
            <x-datafield label="Original">{{ state.name }}</x-datafield>
            <x-datafield label="trim">{{ state.name | trim }}</x-datafield>
            <x-datafield label="upper">{{ state.name | trim | upper }}</x-datafield>
            <x-datafield label="lower">{{ state.name | trim | lower }}</x-datafield>
            <x-datafield label="slug">{{ state.name | slug }}</x-datafield>
            <x-datafield label="stringify">{{ state.name | stringify }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ state.name | trim }}
{{ state.name | trim | upper }}
{{ state.name | trim | lower }}
{{ state.name | slug }}
{{ state.name | stringify }}</code></pre>

        <h2>String predicates</h2>
        <p>Predicate transformers evaluate a condition and return a Boolean value. They perform case-sensitive comparisons.</p>
        <x-datafields columns="2">
            <x-datafield label="startsWith('Ada')">{{ state.name | trim | startsWith('Ada') }}</x-datafield>
            <x-datafield label="endsWith('Lovelace')">{{ state.name | trim | endsWith('Lovelace') }}</x-datafield>
            <x-datafield label="contains('Love')">{{ state.name | contains('Love') }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ state.name | trim | startsWith('Ada') }}
{{ state.name | trim | endsWith('Lovelace') }}
{{ state.name | contains('Love') }}</code></pre>

        <h2>Number transformers</h2>
        <p>Number transformers format numeric values according to the active locale. The argument specifies the number of decimal places.</p>
        <x-datafields columns="2">
            <x-datafield type="number" label="Price" x-model="state.price"></x-datafield>
            <x-datafield type="number" label="Ratio" x-model="state.ratio"></x-datafield>
        </x-datafields>
        <x-datafields columns="2">
            <x-datafield label="number(2)">{{ state.price | number(2) }}</x-datafield>
            <x-datafield label="percent(1)">{{ state.ratio | percent(1) }}</x-datafield>
            <x-datafield label="currency('EUR', 2)">{{ state.price | currency('EUR', 2) }}</x-datafield>
            <x-datafield label="currency('USD', 2)">{{ state.price | currency('USD', 2) }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ state.price | number(2) }}
{{ state.ratio | percent(1) }}
{{ state.price | currency('EUR', 2) }}
{{ state.price | currency('USD', 2) }}</code></pre>
        <p>The <code>percent</code> transformer multiplies the input by 100 for display. For example, <code>0.42</code> is displayed as <code>42%</code>.</p>

        <h2>Date and time transformers</h2>
        <p>Use <code>date</code>, <code>time</code>, and <code>datetime</code> with supported format patterns to display date and time values.</p>
        <p>Source value: <code>{{ state.createdAt }}</code></p>
        <x-datafields columns="2">
            <x-datafield label="date">{{ state.createdAt | date('dd/MM/yyyy') }}</x-datafield>
            <x-datafield label="time">{{ state.createdAt | time('HH:mm:ss') }}</x-datafield>
            <x-datafield label="datetime">{{ state.createdAt | datetime('yyyy-MM-dd HH:mm') }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ state.createdAt | date('dd/MM/yyyy') }}
{{ state.createdAt | time('HH:mm:ss') }}
{{ state.createdAt | datetime('yyyy-MM-dd HH:mm') }}</code></pre>
        <p>Date and time output follows the active locale and its time-zone behavior.</p>

        <h2>JSON transformers</h2>
        <p>Use <code>json_stringify</code> to serialize a JSON-compatible value and <code>json_parse</code> to convert JSON text back into a value.</p>
        <x-datafields columns="1">
            <x-datafield label="JSON object">{{ state.profile | json_stringify }}</x-datafield>
            <x-datafield label="Parsed name">{{ (state.jsonText | json_parse).name }}</x-datafield>
            <x-datafield label="Round trip">{{ state.jsonText | json_parse | json_stringify }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ state.profile | json_stringify }}
{{ (state.jsonText | json_parse).name }}
{{ state.jsonText | json_parse | json_stringify }}</code></pre>
        <p>The <code>stringify</code> transformer is intended for display, while <code>json_stringify</code> produces JSON text.</p>

        <h2>Chaining transformers</h2>
        <p>Each transformer receives the result of the previous step. Pipeline arguments can also contain their own transformer expressions.</p>
        <x-datafield type="text" label="Currency code" x-model="state.currencyCode"></x-datafield>
        <p>Formatted price: <strong>{{ state.price | currency(state.currencyCode | trim | upper, 2) }}</strong></p>
        <pre x-pre><code>{{ state.name | trim | upper }}
{{ state.price | currency(state.currencyCode | trim | upper, 2) }}</code></pre>
        <p>The first expression trims whitespace before converting to uppercase. The second normalizes the currency code before passing it to <code>currency</code>.</p>

        <h2>Null values</h2>
        <p>Most transformers propagate <code>null</code> without applying their operation. The <code>json_stringify</code> transformer is an exception: it produces the JSON text <code>null</code>.</p>
        <x-datafields columns="2">
            <x-datafield label="trim | upper">{{ (state.nullableValue | trim | upper) ?? "(null)" }}</x-datafield>
            <x-datafield label="json_stringify">{{ state.nullableValue | json_stringify }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>{{ (state.nullableValue | trim | upper) ?? "(null)" }}
{{ state.nullableValue | json_stringify }}</code></pre>

        <h2>Pipeline syntax</h2>
        <p>Transformers are part of the X Template expression language. They are not arbitrary JavaScript functions, and template expressions cannot invoke general JavaScript methods.</p>
        <pre x-pre><code>{{ state.name | trim | upper }}
{{ state.price | number(2) }}</code></pre>
        <p>For general expression and binding examples, see <x-anchor href="02-bindings.js">Bindings</x-anchor>. Continue with <x-anchor href="08-advanced.js">Advanced Templates</x-anchor> for more expression patterns.</p>
    `,

    state: {
        name: "  Ada Lovelace  ",
        price: 1234.567,
        ratio: 0.42,
        currencyCode: " eur ",
        createdAt: "2026-09-24T14:35:06+02:00",
        profile: {name:"Ada", enabled:true},
        jsonText: '{"name":"Ada","enabled":true}',
        nullableValue: null
    }
};
