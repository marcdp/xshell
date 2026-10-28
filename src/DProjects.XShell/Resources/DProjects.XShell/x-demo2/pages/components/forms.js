export default {
    template: `
        <h1>Form Inputs</h1>
        <p>The model directive keeps an input and private Page state in sync.</p>
        <x-form>
            <x-datafields>
                <x-datafield label="Name" type="text" x-model="state.name"></x-datafield>
                <x-datafield label="Age" type="number" x-model="state.age"></x-datafield>
            </x-datafields>
        </x-form>
        <p>Hello {{ state.name }} ({{ state.age }})</p>
        <pre x-pre><code>&lt;x-datafield label="Name" x-model="state.name"&gt;&lt;/x-datafield&gt;</code></pre>
        
    `,
    state: { name: "Ada", age: 36 }
};
