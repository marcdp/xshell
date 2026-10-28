export default {
    meta: {
        title: "Text Binding",
        description: "Double braces render state values as text."
    },

    template: `
        <p>Double braces render state values as text.</p>
        <p>Hello {{ state.name }}.</p>
        <label>Name <input x-model="state.name"></label>
        <pre x-pre><code>export default {
    template: &#96;&lt;p&gt;Hello {{ state.name }}.&lt;/p&gt;&#96;,
    state: { name: "Ada" }
};</code></pre>
        
    `,

    state: {
        name: "Ada"
    }
};
