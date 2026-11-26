// page
export default {
    contract: {
        description: "Search configured providers.",
        events: {},
        properties: {},
        methods: {
            focus: {description: "Focuses the search input."}
        }
    },
    meta: {
        title: "Search",
        description: "Enter at least 3 characters to search",
        classes: ["stack-size-narrow", "embed-size-medium"]
    },
    style:`
        x-listview-head {display:none;}
        .tags {display: flex; justify-content: center; flex-wrap: wrap;gap: .25em;align-items: center;}
    `,
    template: `
        <x-datafields>
            <x-datafield type="search" placeholder="Search" x-model="state.keyword" autocomplete="off" autofocus></x-datafield>

            <x-loading x-if="state.loading" role="status" aria-label="Loading search results"></x-loading>
            
            <x-notice x-if="state.errors.length > 0" type="warning" label="Some results are unavailable" x-attr:message="state.errorMessage"></x-notice>

            <div x-if="state.results.length > 0">
                <x-listview view="details" title="Search results">
                    <x-listview-head>
                        <x-listview-column></x-listview-column>
                        <x-listview-column width="5em"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item
                            x-for="result in state.results"
                            x-attr:key="result.providerId + ':' + result.id"
                            x-attr:label="result.label"
                            x-attr:description="result.description"
                            x-attr:icon="result.icon"
                            x-attr:category="result.category"
                            x-attr:tooltip="result.description"
                            x-attr:open="result.open"
                        >
                            <div class="tags">
                                <x-chip x-attr:label="result.providerId"></x-chip>
                            </div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
                <div><br><b>{{ state.results.length }}</b> results found for <b>{{state.searched}}</b></div>
            </div>

            <x-empty x-if="!state.loading && state.searched.length > 2 && state.results.length == 0" icon="x-search" label="No results" message="No matching resources were found."></x-empty>

        </x-datafields>
    `,
    state: {
        keyword: "",
        searched: "",
        results: [],
        errors: [],
        errorMessage: "",
        loading: false
    },
    controller({state, events, search}) {
        let alive = true;
        let debounceId = null;
        let request = null;

        return {
            load() {
                // Debounce reactive text changes while keeping the three-character threshold as Page policy.
                events.on(state, "change:keyword", "queueSearch");
            },
            focus() {
                page.refs.search?.focus();
            },
            queueSearch() {
                // Cancel active work immediately and schedule only the latest eligible keyword.
                request?.abort();
                request = null;
                if (debounceId !== null) clearTimeout(debounceId);
                const keyword = state.keyword.trim();
                if (keyword.length < 3) {
                    state.searched = "";
                    state.results = [];
                    state.errors = [];
                    state.errorMessage = "";
                    state.loading = false;
                    debounceId = null;
                    return;
                }
                debounceId = setTimeout(() => {
                    debounceId = null;
                    this.search(keyword);
                }, 200);
            },
            async search(keyword = state.keyword.trim()) {
                // Publish only the response associated with the latest live Page request.
                if (!alive || keyword.length < 3) return;
                request?.abort();
                request = new AbortController();
                const currentRequest = request;
                state.loading = true;
                state.errors = [];
                state.errorMessage = "";
                try {
                    const response = await search.query(keyword, {signal: currentRequest.signal});
                    if (!alive || currentRequest.signal.aborted) return;
                    state.searched = keyword;
                    state.results = response.results;
                    state.errors = response.errors;
                    state.errorMessage = response.errors.map(error => error.message).join(" ");
                } catch (error) {
                    if (!alive || currentRequest.signal.aborted || error?.name === "AbortError") return;
                    state.searched = keyword;
                    state.results = [];
                    state.errors = [{providerId: "search", message: "Search is temporarily unavailable."}];
                    state.errorMessage = "Search is temporarily unavailable.";
                } finally {
                    if (alive && request === currentRequest) {
                        state.loading = false;
                        request = null;
                    }
                }
            },
            unload() {
                // Stop timers and pending providers before the Page Services scope is disposed.
                alive = false;
                if (debounceId !== null) clearTimeout(debounceId);
                request?.abort();
                request = null;
            }
        };
    }
};
