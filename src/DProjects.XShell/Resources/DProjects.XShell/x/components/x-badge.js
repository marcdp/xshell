
// component
export default {
    contract: {
        description: "Displays a short badge value.",
        tags: ["feedback", "labels"],
        events: {},
        properties: {
            value: {type:"string", default:"", attribute:true, state:true, description:""}
        },
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Show a count next to a label.",
                template: `Inbox <x-badge value="3"></x-badge>`
            }
        ]
    },
    style: `
        :host {}
        :host .message {
            display:inline-block;
            border-radius:1em; 
            background-color:var(--x-color-primary); 
            color:var(--x-color-white);
            padding:.225em .5em .175em .5em; 
            font-size:var(--x-font-size-x-small); 
            line-height:calc(var(--x-font-size-x-small) + .25em);
            font-weight:600; 
            text-align:center;
            min-width:1.75em;
            box-sizing:border-box;
        }

        :host(.plain) .message {
            color: var(--x-color-primary); 
            background-color: var(--x-color-background-page);
            border:.1em var(--x-color-primary) solid;
        }
    `,
    template: `
        <span class="message" x-text="state.value" ></span>
    `,
    state: {
    }
};


