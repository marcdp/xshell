
// component
export default {
    contract: {
        description: "Displays tab headers and the selected tab panel.",
        tags: ["navigation", "tabs", "selection"],
        events: {
            tabchange: {
                description: "Raised when the user selects a different tab.",
                detail: { selectedIndex: { type: "number" } }
            }
        },
        properties: {
            selectedIndex: {type:"number", default:0, attribute:true, state:true, description:""},
            selectedHash:  {type:"string", default:"", attribute:true, state:true, description:""},
            useHash:       {type:"boolean", default:false, attribute:true, state:true, description:"Whether to use the hash in the URL to track the selected tab."}
        },
        methods: {},
        slots: {
            "": {
                description: "Content for the tab panels"
            }
        },
        examples: [
            {
                name: "basic",
                description: "Group related content in labeled tab panels.",
                template: `
                    <x-tabs>
                        <x-tab label="Overview"><p>Project summary</p></x-tab>
                        <x-tab label="Activity"><p>Recent changes</p></x-tab>
                    </x-tabs>
                `
            },
            {
                name: "initial-selection",
                description: "Start with the second tab selected using its zero-based index.",
                template: `
                    <x-tabs selected-index="1">
                        <x-tab label="Overview"><p>Project summary</p></x-tab>
                        <x-tab label="Activity"><p>Recent changes</p></x-tab>
                    </x-tabs>
                `
            },
            {
                name: "page-hash",
                description: "Use the containing Page's fragment to remember the active panel.",
                template: `
                    <x-tabs use-hash>
                        <x-tab label="Overview" hash="overview"><p>Project summary</p></x-tab>
                        <x-tab label="Activity" hash="activity"><p>Recent changes</p></x-tab>
                    </x-tabs>
                `
            },
            {
                name: "sidebar",
                description: "Display tabs with vertical navigation beside the selected content.",
                template: `
                    <x-tabs class="sidebar">
                        <x-tab label="Overview"><p>Resource overview.</p></x-tab>
                        <x-tab label="Properties"><p>Resource properties.</p></x-tab>
                        <x-tab label="Examples"><p>Usage examples.</p></x-tab>
                    </x-tabs>
                `
            }
        ]
    },
    style: `
        :host {display:block; }
        
        nav {margin-bottom:1.5em; border-bottom:var(--x-accordion-border); display:flex;overflow-x:auto;flex-wrap:wrap;}        
        nav a {padding-left:1em; padding-right:1em; cursor:pointer; position:relative; line-height:2.5em; display:block; flex:unset; font-size:var(--x-font-size-tab); font-weight:600; white-space:nowrap; }
        nav a:after {content:""; border-radius:.1em; position:absolute; width:calc(100% - .25em); bottom:0; left:0; }
        nav a:hover {color:var(--x-color-primary);}
        nav a.selected {font-weight:600; color:var(--x-color-primary);}
        nav a.selected:after {font-weight:600; border:.125em var(--x-color-primary) solid;}
        :host(.no-header) nav {display:none;}
        @media only screen and (max-width: 768px) {
            nav a {
                font-size:var(--x-font-size-text);
                padding-left:.75em; 
                padding-right:.75em;
            }
        }

        /* x-tab */
        ::slotted(x-tab) {display:none;}

        /* sidebar */
        :host(.sidebar) {
            display:flex; 
            flex-direction: row;            
        }
        :host(.sidebar) nav {
            box-sizing:border-box; 
            flex:0 0 100%; 
            min-width:0;
            padding:1em;
            flex-direction:column; 
            flex-basis:18em; 
            flex-direction:column; 
            flex-wrap:nowrap; 
            margin:0 1.25em 0 0; 
            border:0; 
            background: var(--x-layout-main-drawer-background);
        }
        :host(.sidebar) nav a {
        min-width:0; 
            white-space:normal; 
            overflow-wrap:anywhere; 
            font-size:unset; font-weight:normal; border:none; border-radius: var(--x-menuitem-border-radius);
            padding-left:.75em; 
            line-height:2.1em; height:2.1em;
            margin-bottom:.1em;
        }
        :host(.sidebar) nav a:hover {color:unset; background: var(--x-color-background-x-gray);}
        :host(.sidebar) nav a.selected {border:none; font-weight: 500; background: var(--x-color-background-x-gray); color:unset;}
        :host(.sidebar) nav a.selected:after {border:none;}
        :host(.sidebar) slot {display:block; flex:1 1 100%; min-width:0; overflow-wrap:anywhere; overflow-x:auto; flex-basis:0; height:100%; scrollbar-width: var(--x-scrollbar-width); scrollbar-gutter: var(--x-scrollbar-gutter);}

    `,
    state: {
        tabs: [],
        useHash: false,
    },
    template: `
        <nav>
            <a x-for="(tab,index) in state.tabs" 
                x-attr:tabindex="index+1"
                x-text="tab.label" 
                x-attr:icon="tab.icon" 
                x-class:plain="true"
                x-class:selected="index == state.selectedIndex"
                x-on:click="click"
                x-on:keydown.enter="click"
                ></a>
        </nav>        
        <slot x-on:slotchange="refresh"></slot>
    `, 
    controller({ state, events, getPage, host }) {
        let styleSheet = new CSSStyleSheet();
        return {
            load() {
                //load
                events.on(state, "change:selectedHash", (event) => {
                    let hash = event.newValue;
                    let tabs = host.querySelectorAll(":scope > x-tab");
                    let tab = Array.from(tabs).find(tab => tab.getAttribute("hash") == hash);
                    let tabIndex = Array.from(tabs).indexOf(tab);
                    if (tabIndex != -1) state.selectedIndex = tabIndex;
                    this.refresh();
                });
                events.on(state, "change:selectedIndex", (event) => {
                    let selectedIndex = event.newValue;
                    let tabs = host.querySelectorAll(":scope > x-tab");
                    let tab = tabs[selectedIndex];
                    if (tab) state.selectedHash = tab.hash;
                    this.refresh();
                });
            },
            mount() {
                //mount
                host.shadowRoot.adoptedStyleSheets = [...host.shadowRoot.adoptedStyleSheets, styleSheet];
                if (state.useHash) {
                    const page = getPage();
                    if (page) {
                        const hash = page.src.split("#")[1];
                        if (hash) {
                            state.selectedHash = "";
                            state.selectedHash = hash;
                        }
                    }
                }
                this.refresh();
            },

            click(params) {
                // Let consumers persist changes made through the tab headers.
                const { event } = params;
                event.preventDefault();
                const selectedIndex = Array.from(host.shadowRoot.querySelectorAll("nav a")).indexOf(event.target);
                if (selectedIndex < 0 || selectedIndex === state.selectedIndex) return;
                state.selectedIndex = selectedIndex;
                this.refresh();
                host.dispatchEvent(new CustomEvent("tabchange", { detail: { selectedIndex } }));
            },

            refresh(params) {
                //refresh
                let tabs = [];
                host.querySelectorAll(":scope > x-tab").forEach(tab => {
                    tabs.push({
                        label: tab.getAttribute("label"),
                        icon: tab.getAttribute("icon") || "",
                        hash: tab.getAttribute("hash") || ""
                    });
                });
                state.tabs = tabs;
                styleSheet.replaceSync(`::slotted(x-tab:nth-child(${parseInt(state.selectedIndex) + 1})) {display:block;}`);
                // hash
                const tab = tabs[state.selectedIndex];
                const page = getPage();
                if (state.useHash && tab) {
                    if (page) {
                        const currentHash = page.src.split("#")[1] || "";
                        if (tab.hash !== currentHash) page.replaceHash(tab.hash);
                    }
                }
            }
        }
    }
};

