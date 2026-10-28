export default {
    meta: {
        title: "Data Display",
        description: "Use display components for simple values and structured data."
    },

    template: `
        <p>Use display components for simple values and structured data.</p>
        <x-datafields>
            <x-datafield label="Size"><x-file-size value="2048"></x-file-size></x-datafield>
            <x-datafield label="Date"><x-datetime value="2026-01-01T12:00:00Z"></x-datetime></x-datafield>
        </x-datafields>
        <x-json x-prop:value="state.record"></x-json>
        
    `,

    state: {
        record: { name: "Ada", active: true }
    }
};
