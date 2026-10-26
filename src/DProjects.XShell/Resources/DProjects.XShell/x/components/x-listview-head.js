// contract
export const contract = {
    description: "Provides the header container for x-listview columns.",
    events: {},
    properties: {},
    methods: {},
    slots: {
        "": {
            description: "Default slot for x-listview-column elements."
        }
    }
};


// implementation
export default {
    style: `
        :host {display: block; min-width: 0; box-sizing: border-box; }
        :host([hidden]) {display:none!important;}

        /* list */
        @container style(--x-listview-view: 'list') {
            :host {display:none;}
        }

        /* details */
        @container style(--x-listview-view: 'details') {
            :host {
                display: grid;
                grid-template-columns: var(--x-listview-grid-template-columns);
                line-height: 1.8em;
            }
        }

        /* icons */
        @container style(--x-listview-view: 'icons') {
            :host {display:none;}
        }

        /* tiles */
        @container style(--x-listview-view: 'tiles') {
            :host {display:none;}

        }
    `,
    template: `<slot></slot>`
};
