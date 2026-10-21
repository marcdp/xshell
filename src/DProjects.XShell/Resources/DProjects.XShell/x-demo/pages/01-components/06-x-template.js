// contract
export const contract = {
    description: "X template test page",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {    

    template: `
        <x-template x-prop:template="state.template" x-model="state.value" x-on:command="templateCommand"></x-template>
        <hr/>
        <x-json x-prop:value="state.value" indent="2"></x-json>
    `,  
    state: {
        template: `
            <p>Hello world</p> {{state.a * 2}}
            <li x-for="item in state.c">{{item}}</li>
            <x-datafields columns="2">
                <x-datafield label="Check" x-model="state.b" type="checkbox"></x-datafield>
                <x-datafield label="Name" x-model="state.d" type="text"></x-datafield>
            </x-datafields>
            <x-button x-on:click="innerCommand1" label="Click me"></x-button>
        `,
        value: {
            a: 13,
            b: true,
            c: [1,2,3,4,5],
            d: "Marc"
        }
    },
    controller({ state, dependencies }) {
        return {
            async load() {
                // load
            },
            templateCommand(event) {
                // Handle commands coming from the x-template component
                alert("Clicked")
            },
            templateStateChange(event) {
                alert(123);
                // Handle state changes coming from the x-template component
                console.log("Template state change received:", event.detail);
            }
        };
    }
}
