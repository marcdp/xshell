export default {
    template: `
        <h1>Attributes and Properties</h1>
        <p>Attributes serialize strings; property bindings retain JavaScript values.</p>
        <p x-attr:title="state.tip">Hover for a bound title.</p>
        <x-json x-prop:value="state.record"></x-json>
        <pre x-pre><code>&lt;x-json x-prop:value="state.record"&gt;&lt;/x-json&gt;</code></pre>
        
    `,
    state: { tip: "Bound title", record: { answer: 42 } }
};
