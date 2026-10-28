export default {
    meta: {
        title: "Attributes and Properties",
        description: "Attributes serialize strings; property bindings retain JavaScript values."
    },

    template: `
        <p>Attributes serialize strings; property bindings retain JavaScript values.</p>
        <p x-attr:title="state.tip">Hover for a bound title.</p>
        <x-json x-prop:value="state.record"></x-json>
        <pre x-pre><code>export default {
    template: &#96;&lt;x-json x-prop:value="state.record"&gt;&lt;/x-json&gt;&#96;,
    state: { record: { answer: 42 } }
};</code></pre>
        
    `,

    state: {
        tip: "Bound title",
        record: { answer: 42 }
    }
};
