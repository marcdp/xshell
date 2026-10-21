// contract
export const contract = {
    description: "Client-side XTemplate interpreter",
    events: {},
    properties: {},
    methods: {}
};

// page
export default {
    meta: {
        renderEngine: "x-client"
    },

    template: `
        <h2>XTemplate Client Renderer</h2>

        <x-datafields>
            <x-datafield
                label="Name"
                type="text"
                x-model="state.name">
            </x-datafield>

            <x-datafield
                label="Minimum"
                type="number"
                x-model="state.min">
            </x-datafield>

            <x-datafield
                label="Maximum"
                type="number"
                x-model="state.max">
            </x-datafield>
        </x-datafields>

        <p>Hello {{ state.name }}.</p>

        <p x-if="state.name">
            Name has a value.
        </p>
        <p x-else>
            Enter a name.
        </p>

        <x-form-assert
            x-prop:test="state.min <= state.max"
            label="Range">
            Minimum must be less than or equal to maximum.
        </x-form-assert>

        <h3>Items</h3>

        <ul>
            <li x-for="item in state.items" x-key="id">
                {{ item.label }}
            </li>
        </ul>

        <x-button label="Add item" x-on:click="addItem"></x-button>
        <x-button label="Toggle" x-on:click="toggle"></x-button>

        <div x-show="state.visible">
            x-show works.
        </div>

        <p>
            Count: {{ state.items.length }}
        </p>

        <x-json x-prop:value="state"></x-json>
    `,

    state: {
        name: "Marc",
        min: 10,
        max: 20,
        visible: true,
        nextId: 3,
        items: [
            { id: 1, label: "One" },
            { id: 2, label: "Two" }
        ]
    },

    controller({ state }) {
        return {
            load() {
                debugger;
            },
            addItem() {
                state.items = [
                    ...state.items,
                    {
                        id: state.nextId,
                        label: `Item ${state.nextId}`
                    }
                ];

                state.nextId++;
            },

            toggle() {
                state.visible = !state.visible;
            }
        };
    }
};