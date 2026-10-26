// contract
export const contract = {
    description: "Provides the presentation container for x-listview2 items.",
    events: {},
    properties: {},
    methods: {},
    slots: {
        "": {
            description: "Default slot for x-listview2-item elements."
        }
    }
};


// implementation
export default {
    style: `
        :host {display: block;min-width: 0;}
        :host([hidden]) {display:none!important;}
        :host .items {min-width:0;}

        /* list */
        @container style(--x-listview2-view: 'list') {
            .items {
                display: block;
                column-width: 15em;
                column-gap: 1rem;
                
            }
            ::slotted(x-listview2-item) {break-inside: avoid;}
        }

        /* details */
        @container style(--x-listview2-view: 'details') {
            .items {
                display:block;
                width:100%;
            }
        }

        /* icons */
        @container style(--x-listview2-view: 'icons') {
            .items {
                display: flex;
                flex-wrap: wrap;
                align-items: flex-start;
                gap: .4em;
            }
            ::slotted(x-listview2-item) {flex: 0 0 6.5em; width: 6.5em;}
        }

        /* tiles */
        @container style(--x-listview2-view: 'tiles') {
            .items {
                display: flex;
                flex-wrap: wrap;
                container: items / inline-size;
            }
            ::slotted(x-listview2-item) {flex: 0 0 17em; width: 17em; max-width: 100%;}

            @container items (width < 70em) {
                ::slotted(x-listview2-item) {flex-basis:33.333%; width:33.333%;}
            }
            @container items (width < 50em) {
                ::slotted(x-listview2-item) {flex-basis:50%; width:50%;}
            }
            @container items (width < 30em) {
                ::slotted(x-listview2-item) {flex-basis:100%; width:100%;}
            }
        }

        
    `,
    template: `
    <div class="items"><slot></slot></div>`
};
