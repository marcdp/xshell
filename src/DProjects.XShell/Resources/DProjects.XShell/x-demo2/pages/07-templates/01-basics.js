export default {
    meta: { title: "Text Binding", description: "Double braces render state values as text." },
    template: `
        <p>Double braces render state values as text.</p>
        <p>Hello {{ state.name }}.</p>
        <label>Name <input x-model="state.name"></label>
        <pre x-pre><code>&lt;p&gt;Hello {{ state.name }}.&lt;/p&gt;</code></pre>
        
    `,
    state: { name: "Ada" }
};
