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
        classes: ["stack-size-narrow", "embed-size-medium", "embed-padding", "embed-no-title"]
    },
    style:`
        x-listview-head {display:none;}
        .tags {display: flex; justify-content: center; flex-wrap: wrap;gap: .25em;align-items: center;}
        .provider {display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:.25em 1em; margin-block:.75em;}
        .provider-description {color:var(--x-color-text-gray); font-size:var(--x-font-size-small);}
        .prefixes {display:flex; flex-wrap:wrap; gap:.25em;}
        .prefixes button {padding:0; border:0; border-radius:1em; background:none; cursor:pointer; font:inherit;}
    `,
    template: `
        <x-datafields columns="1">
            <x-datafield ref="search" label="Search" type="search" placeholder="Search pages, commands, queries..."
                description="Enter at least 3 characters to search" x-model="state.keyword" autocomplete="off" autofocus></x-datafield>

            <section x-if="!(state.keyword | trim) && state.providers.length > 0" aria-label="Search expressions">
                <b>Search expressions</b>
                <div class="provider" x-for="provider in state.providers" x-key="id">
                    <div>
                        <!--<x-icon x-if="provider.icon" x-attr:icon="provider.icon" aria-hidden="true"></x-icon>-->
                        <b x-text="provider.label"></b>
                        <div class="provider-description" x-if="provider.description" x-text="provider.description"></div>
                    </div>
                    <div class="prefixes">
                        <button type="button" x-for="prefix in provider.prefixes" x-on:click="selectPrefix"
                            x-attr:data-prefix="prefix" x-attr:aria-label="'Use prefix ' + prefix">
                            <x-chip x-attr:label="prefix"></x-chip>
                        </button>
                    </div>
                </div>
            </section>

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
                            x-attr:href="result.href"
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

            <x-empty x-if="!state.loading && state.noResults" icon="x-search" x-attr:label="'No results for ' + state.searched" message="No matching resources were found"></x-empty>

        </x-datafields>
    `,
    state: {
        keyword: "",
        providers: [],
        searched: "",
        results: [],
        errors: [],
        errorMessage: "",
        loading: false,
        noResults: false
    },
    controller({page, state, events, search}) {
        let alive = true;
        let debounceId = null;
        let request = null;

        return {
            load() {
                // Guide users with the prefixes configured for this application.
                state.providers = search.listProviders().filter(provider => provider.prefixes.length > 0);
                // Debounce reactive text changes while keeping the three-character threshold as Page policy.
                events.on(state, "change:keyword", "queueSearch");
            },
            focus() {
                // The template ref is available once the Page has mounted and rendered.
                if (page.host) page.refs.search?.focus();
            },
            selectPrefix({event}) {
                // Start an expression and put focus back in the field for typing.
                state.keyword = event.currentTarget.dataset.prefix + " ";
                this.focus();
            },
            isSearchable(expression) {
                // Reject a standalone prefix with the same literal, case-insensitive comparison as Search.
                return expression.length >= 3 && !state.providers.some(provider => provider.prefixes.some(prefix => {
                    const literal = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    return new RegExp("^" + literal + "$", "iu").test(expression);
                }));
            },
            queueSearch() {
                // Cancel active work immediately and schedule only the latest eligible keyword.
                request?.abort();
                request = null;
                if (debounceId !== null) clearTimeout(debounceId);
                state.loading = false;
                state.noResults = false;
                const keyword = state.keyword;
                if (!this.isSearchable(keyword.trim())) {
                    state.searched = "";
                    state.results = [];
                    state.errors = [];
                    state.errorMessage = "";
                    debounceId = null;
                    return;
                }
                debounceId = setTimeout(() => {
                    debounceId = null;
                    this.search(keyword);
                }, 200);
            },
            async search(keyword = state.keyword) {
                // Publish only the response associated with the latest live Page request.
                const expression = keyword.trim();
                if (!alive || !this.isSearchable(expression)) return;
                request?.abort();
                request = new AbortController();
                const currentRequest = request;
                state.loading = true;
                state.noResults = false;
                state.errors = [];
                state.errorMessage = "";
                try {
                    debugger
                    const response = await search.query(keyword, {signal: currentRequest.signal});
                    if (!alive || currentRequest.signal.aborted) return;
                    state.searched = expression;
                    state.results = response.results;
                    state.errors = response.errors;
                    state.errorMessage = response.errors.map(error => error.message).join(" ");
                    state.noResults = response.results.length === 0 && response.errors.length === 0;
                } catch (error) {
                    if (!alive || currentRequest.signal.aborted || error?.name === "AbortError") return;
                    state.searched = expression;
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
