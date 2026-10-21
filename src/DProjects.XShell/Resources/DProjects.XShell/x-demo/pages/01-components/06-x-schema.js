// contract
export const contract = {
    description: "X-Schema editor component",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {    
    dependencies: {
        schema: "object:x-schema:/samples/sample1.x-schema.json",
        value: "object:x-schema:/samples/sample1.json",
    },
    template: `
        <x-form>
            <x-datafields>
                <x-datafield label="Customer editor">
                    <x-schema-editor x-prop:schema="state.schema" x-prop:value="state.value" x-on:change="valueChanged">
                    </x-schema-editor>
                </x-datafield>
            </x-datafields>
        </x-form>
        <x-json x-prop:value="state.displayValue" indent="2"></x-json>
    `,  
    state: {
        schema: null,
        value: null,
        displayValue: null
    },
    controller({ state, dependencies }) {
        return {
            async mount() {
                // mount
                state.schema = dependencies.schema;
                state.value = dependencies.value;
                state.displayValue = structuredClone(dependencies.value);
            },
            valueChanged({event}) {
                state.displayValue = structuredClone(event.detail.value);
            }
        };
    }
}
