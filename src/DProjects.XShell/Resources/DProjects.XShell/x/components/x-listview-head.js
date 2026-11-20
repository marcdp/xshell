// component
export default {
    contract: {
        description: "Provides the header container for x-listview columns.",
        events: {},
        properties: {},
        methods: {},
        slots: {
            "": {
                description: "Default slot for x-listview-column elements."
            }
        },
        examples: [
            {
                name: "details",
                description: "Place the details header beside the body.",
                template: `
                    <x-listview view="details">
                        <x-listview-head>
                            <x-listview-column label="Name"></x-listview-column>
                            <x-listview-column label="Type" width="8rem"></x-listview-column>
                        </x-listview-head>
                        <x-listview-body>
                            <x-listview-item label="Notes.txt"><span>Text</span></x-listview-item>
                        </x-listview-body>
                    </x-listview>
                `
            }
        ]
    },
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
