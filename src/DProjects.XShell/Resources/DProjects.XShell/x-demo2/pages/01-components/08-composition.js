export default {
    meta: { title: "Composition", description: "A component can expose a named slot for caller content." },
    template: `
        <p>A component can expose a named slot for caller content.</p>
        <x-empty icon="x-folder" label="No files" message="Add one to continue.">
            <x-button slot="actions" label="Add file"></x-button>
        </x-empty>
        <pre x-pre><code>&lt;x-button slot="actions" label="Add file"&gt;&lt;/x-button&gt;</code></pre>
        
    `
};
