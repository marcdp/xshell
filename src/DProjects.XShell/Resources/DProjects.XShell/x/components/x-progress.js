// contract
export const contract = {
    description: "Displays the progress of an operation.",
    events: {},
    properties: {
        value: {type:"number", default:0,   attribute:true, state:true, description:"The current value of the progress bar."},
        min:   {type:"number", default:0,   attribute:true, state:true, description:"The minimum value of the progress bar."},
        max:   {type:"number", default:100, attribute:true, state:true, description:"The maximum value of the progress bar."},
        unknown: {type:"boolean", default:false, attribute:true, state:true, description:"Displays an animated progress bar when progress is unknown."}
    },
    methods: {}
};


// implementation
export default {
    style: `
        :host {
            display:block;
            width:100%;
            height:var(--x-progress-height, var(--x-loading-height));
            background:var(--x-progress-background);
            border-radius:.25em;
            overflow:hidden;
        }

        .bar {
            display:block;
            height:100%;
            width:0;
            background:var(--x-progress-color);
            border-radius:inherit;
            transition:width var(--x-transition-duration) ease;
        }

        /* Unknown progress animation */
        .bar.unknown {transition: none; animation: x-progress-unknown 1.5s ease-in-out infinite; }
        @keyframes x-progress-unknown {
            from {transform: translateX(-100%);}
            to {transform: translateX(335%);}
        }
        @media (prefers-reduced-motion: reduce) {
            .bar.unknown {animation: none;}
        }
    `,

    template: `
        <div
            class="bar"
            role="progressbar"
            x-class:unknown="state.unknown"
            x-attr:aria-valuemin="state.min"
            x-attr:aria-valuemax="state.max"
            x-attr:aria-valuenow="state.unknown ? null : state.value"
            x-style:width="state.unknown ? '30%' : state.percentage + '%'">
        </div>
    `,
    state: {
        value: 0,
        min: 0,
        max: 100,
        percentage: 0,
        unknown: false
    },
    controller({ state, events, host }) {
        return {
            load() {
               // load
               events.on(state, ["change:value", "change:min", "change:max"], () => {
                   this.refresh();
               });
            },
            refresh(){
                state.percentage = Math.max(0, Math.min(100, ((state.value - state.min) / (state.max - state.min)) * 100));
            }
        };
    }
};
