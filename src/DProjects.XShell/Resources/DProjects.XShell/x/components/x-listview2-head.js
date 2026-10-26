// contract
export const contract = {
    description: "Provides the header container for x-listview2 columns.",
    events: {},
    properties: {},
    methods: {},
    slots: {
        "": {
            description: "Default slot for x-listview2-column elements."
        }
    }
};


// implementation
export default {
    style: `
        :host {display: block; min-width: 0; box-sizing: border-box; }
        :host([hidden]) {display:none!important;}

        /* list */
        @container style(--x-listview2-view: 'list') {
            :host {display:none;}
        }

        /* details */
        @container style(--x-listview2-view: 'details') {
            :host {
                display: grid;
                grid-template-columns: var(--x-listview2-grid-template-columns);
                line-height: 1.8em;
                padding: 0 .35em;
            }
        }

        /* icons */
        @container style(--x-listview2-view: 'icons') {
            :host {display:none;}
        }

        /* tiles */
        @container style(--x-listview2-view: 'tiles') {
            :host {display:none;}

        }
    `,
    template: `<slot></slot>`
};
