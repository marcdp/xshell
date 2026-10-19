// contract
export const contract = {
    description: "X-Schema editor component",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    template: `
        <x-form>
            <x-datafields>
                <x-datafield label="Customer editor">
                    <x-schema-editor 
                        x-prop:schema="state.schema" 
                        x-prop:value="state.value">
                    </x-schema-editor>
                </x-datafield>
            </x-datafields>
        </x-form>
        <x-json x-prop:value="state.value"></x-json>
    `,  
    state: {
        schema: {
            version: "0",
            root: "Customer",
            types: {
                Customer: {
                    kind: "object",
                    children: [
                        {
                            kind: "field",
                            bind: "advanced",
                            dataType: "boolean",
                            tag: "x-datafield",
                            props: { type: "checkbox", label: "Advanced mode" },
                            default: false
                        },
                        {
                            kind: "field",
                            bind: "name",
                            dataType: "string",
                            required: true,
                            tag: "x-datafield",
                            props: { type: "text", label: "Name" },
                            default: ""
                        },
                        {
                            kind: "field",
                            bind: "email",
                            dataType: "string",
                            tag: "x-datafield",
                            props: { type: "email", label: "Email" },
                            conditions: { visible: { path: "$root.advanced", equals: true } },
                            default: ""
                        }
                    ]
                }
            },
        },
        value: { advanced: true, name: "Ada Lovelace", email: "ada@example.test" }
    },
    controller({ }) {
        return {
            load() {
               // load
            }
        };
    }
}
