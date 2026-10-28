export default {
    meta: {
        title: "Form Inputs",
        description: "The model directive keeps an input and private Page state in sync."
    },

    template: `
        <p>The model directive keeps an input and private Page state in sync.</p>
        <x-form>
            <x-datafields>
                <x-datafield label="Name" type="text" x-model="state.name"></x-datafield>
                <x-datafield label="Age" type="number" x-model="state.age"></x-datafield>
            </x-datafields>
        </x-form>
        <p>Hello {{ state.name }} ({{ state.age }})</p>
        <pre x-pre><code>export default {
    template: &#96;&lt;x-form&gt;
                   &lt;x-datafields&gt;
                       &lt;x-datafield label="Name" type="text" x-model="state.name"&gt;&lt;/x-datafield&gt;
                   &lt;/x-datafields&gt;
               &lt;/x-form&gt;
               &lt;p&gt;Hello {{ state.name }}&lt;/p&gt;&#96;,
    state: { name: "Ada" }
};</code></pre>
        
    `,

    state: {
        name: "Ada",
        age: 36
    }
};
