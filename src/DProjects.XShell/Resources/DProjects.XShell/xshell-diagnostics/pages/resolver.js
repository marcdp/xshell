// page
export default {
    contract: {
        description: "Resolver page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Resolver"
    },
    style: `
        .test {margin-bottom:1.5em;}
        .test x-toolbar {margin-bottom:.5em;}
        .test x-datafield {width:40em; max-width:70vw;}
    `,
    template: `
        <p>Shows configured resolver rules and lets you test how a logical resource is resolved.</p>
        <div class="test">
            <x-toolbar>
                <x-datafield type="text" x-model="state.test_resource" placeholder="Resource, e.g. component:x-button"></x-datafield>
                <x-button label="Resolve" command="resolve"></x-button>
                <x-button label="Load" command="resolveAndLoad"></x-button>
            </x-toolbar>

            <x-object x-if="state.test_result" x-prop:value="state.test_result" expanded="true"></x-object>

            <x-notice type="info" x-if="state.test_info">
                {{ state.test_info }}
            </x-notice>
            <x-notice type="error" x-if="state.test_error">
                {{ state.test_error }}
            </x-notice>

        </div>

        <x-listview view="details">
            <x-listview-head>
                <x-listview-column><x-datafield type="search" x-model="state.query_resource" placeholder="Resource"></x-datafield></x-listview-column>
                <x-listview-column><x-datafield type="search" x-model="state.query_src" placeholder="Source"></x-datafield></x-listview-column>
                <x-listview-column width="10em"><x-datafield type="search" x-model="state.query_loader" placeholder="Loader"></x-datafield></x-listview-column>
                <x-listview-column label="Cache" width="5em" style="text-align:right"></x-listview-column>
                <x-listview-column label="Mode" width="5em" style="text-align:right"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
            <x-listview-item x-for="item in state.items" x-attr:label="item.resource" icon="x-settings">
                <div>{{ item.src }}</div>
                <div>{{ item.loader }}</div>
                <div style="text-align:right">{{ item.cache }}</div>
                <div style="text-align:right">{{ item.cacheMode }}</div>
            </x-listview-item>
            </x-listview-body>
        </x-listview>
    `,
    state: {
        test_resource: "",
        test_result: null,
        test_info: "",
        test_error: "",
        query_resource: "",
        query_src: "",
        query_loader: "",
        items: []
    },
    controller({ state, events, resolver, loader }) {
        return {
            load() {
                // load
                this.refresh();
                events.on(state, "change:query_resource", "refresh");
                events.on(state, "change:query_src", "refresh");
                events.on(state, "change:query_loader", "refresh");
            },
            resolve() {
                // resolve
                const resource = state.test_resource.trim();
                state.test_result = null;
                state.test_info = "";
                state.test_error = "";
                if (!resource) {
                    state.test_error = "Enter a resource to resolve.";
                    return;
                }
                // Resolver.resolve() ignores query and fragment when matching.
                const normalizedResource = resource.split("#")[0].split("?")[0];
                if (!resolver.has(normalizedResource)) {
                    state.test_error = "No resolver rule matched the resource: " + resource;
                    return;
                }
                const result = resolver.resolve(resource);
                if (!result) {
                    state.test_error = "Unable to resolve the resource: " + resource;
                    return;
                }
                state.test_result = {
                    resource: resource,
                    rule: result.definition.resource,
                    src: result.definition.src,
                    path: result.path ?? "",
                    url: result.url,
                    loader: result.definition.loader ?? "",
                    cache: result.definition.cache ?? false,
                    cacheMode: result.definition.cacheMode ?? "full"
                };
            },
            async resolveAndLoad() {
                try {
                    state.test_result = null;
                    state.test_info = "";
                    state.test_error = "";
                    const result = await loader.load(state.test_resource);
                    // check if its a class
                    if (typeof result === "function" && /^class\s/.test(Function.prototype.toString.call(result))) {
                        state.test_info = "Loaded resource is a class.";
                    } else {
                        state.test_result = result;
                    }
                } catch (error) {
                    state.test_error = `Error loading resource: ${state.test_resource}, ${error.message}`;
                }
            },
            refresh() {
                // refresh
                state.items = resolver.registry
                    .filter(item =>
                        (!state.query_resource || item.resource.includes(state.query_resource)) &&
                        (!state.query_src || item.src.includes(state.query_src)) &&
                        (!state.query_loader || item.loader?.includes(state.query_loader))
                    )
                    .map(item => ({
                        resource: item.resource,
                        src: item.src,
                        loader: item.loader ?? "",
                        cache: item.cache ? "yes" : "no",
                        cacheMode: item.cacheMode ?? "full"
                    }));
            }
        };
    }
};
