
// component
export default {
    contract: {
        description: "Displays a loading indicator.",
        tags: ["feedback", "loading"],
        events: {},
        properties: {},
        methods: {},
        examples: [
            {
                name: "basic",
                description: "Show a loading indicator while the containing Page is busy.",
                state: {loading: true},
                template: `<x-loading x-if="state.loading" role="status" aria-label="Loading results"></x-loading>`
            }
        ]
    },
    style: `
        :host {
            display:block;
            position:relative;
            width:100%;            
            background:var(--x-loading-background);
            height:var(--x-loading-height);
            border-radius:.25em;
        }
        :host div {
            display:block;

            animation: progressBar var(--x-loading-duration) ease-in-out; 
            animation-delay: var(--x-loading-delay);   
            animation-fill-mode: both; 
            animation-iteration-count: infinite;

            background:var(--x-loading-color);
            height:var(--x-loading-height);
            border-radius:.25em;
            position:absolute;
            
        }
        @keyframes progressBar {
            0% { left:0; width: 0; }
            50% { left:0; width: 100%;}
            100% {left:100%; width: 0;}
        } 
    `,
    template: `
        <div></div>
    `
}; 
