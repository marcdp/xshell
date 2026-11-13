
// component
export default {
    contract: {
        description: "Displays diagnostic information about the current Page",
        events: {},
        properties: {},
        methods: {}
    },
    style: `
        :host {display:block; }
        h3 {font-weight:600; margin-top:0;}
        x-object {width:40em;}
    `,
    template: `
        <x-dropdown class="popover left fixed" collapse-on-click >
            <x-button class="light round" icon="x-info" tooltip="Page information"></x-button>
            <div slot="dropdown" x-if="state.id">
                <h3>Page information</h3>
                <x-object x-prop:value="state" expanded="true"></x-object>
                <x-anchor x-attr:href="state.href" target="_blank" class="plain">Open page in new browser tab <x-icon icon="x-open-in-new"></x-icon></x-anchor>
            </div>
        </x-dropdown>
        
    `,
    state: {
        id: "",
        label: "",
        description: "",
        href: "",
        path: "",
        module: "",
        status: "",
        query: {},
        breadcrumb: [],
        context: {},
        contract: null
    },
    controller({ events, config, bus, state, getPage, areas, host}) {
        return {
            async load() {
                // mount
                //host.style.display = (config.app.environment.toLowerCase() === "development") ? "block" : "none";
                events.on(bus, ["xshell:page:load", "xshell:page:change"], (event) => {
                    let page = getPage();
                    if (event.detail.id == page?.id) {
                        this.refresh();
                    }
                });
            },  
            mount() {
                // mount
                let page = getPage();
                if (page!=null) this.refresh();
            },
            refresh() {
                // refresh
                const page = getPage();
                const url = areas.resolveHref(page.src);   
                state.id = page.id; 
                state.label = page.label; 
                state.description = page.description; 
                state.href = page.src;
                state.query = page.query;
                state.path = page.path;
                state.module = url?.module ?? areas.getModuleId(page.src);
                state.status = page.host.status;
                state.breadcrumb = page.breadcrumb;
                state.context = page.context || {};
                state.contract = page.contract;
                state.layout = page.layout;
                state.meta = page.meta || {};
                const object = host.shadowRoot.querySelector("x-object");
                object?.refresh();
            }
        }
    }
};

