export default {
    meta: { title: "File Selection", description: "The browser supplies local File values through a file data field." },
    template: `
        <p>The browser supplies local File values through a file data field.</p>
        <x-datafield label="Choose one file" type="file" x-model="state.file"></x-datafield>
        <p x-if="state.file">Selected: {{ state.file.name }}</p>
        
    `,
    state: { file: null }
};
