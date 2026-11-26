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
        description: "Search configured providers or list available results by prefix",
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
                description="Type at least 3 characters, or press Enter after a prefix." x-model="state.keyword" autocomplete="off" autofocus
                x-on:keydown.enter="submitSearch" x-on:compositionstart="startComposition" x-on:compositionend="endComposition"></x-datafield>

            <section x-if="!(state.keyword | trim) && state.providers.length > 0" aria-label="Search expressions">
                <b>Search expressions</b>
                <div>Type a prefix followed by search text, or press Enter after a prefix to list available results.</div>
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
                <div><br>Results returned for <b>{{state.searched}}</b> ({{ state.results.length }})</div>
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
        let composing = false;
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
            isSearchable(expression, explicit = false) {
                // Recognize only exact standalone prefixes for the Page's automatic and explicit search rules.
                const standalone = state.providers.some(provider => provider.prefixes.some(prefix => {
                    const literal = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    return new RegExp("^" + literal + "$", "iu").test(expression);
                }));
                return standalone ? explicit : expression.length >= 3;
            },
            submitSearch({event}) {
                // The native key event crosses the datafield's shadow root. Only the search input can submit.
                if (composing || event.isComposing || event.keyCode === 229 || event.repeat || event.defaultPrevented ||
                    !event.composedPath()[0]?.matches?.("input[type='search']")) return;
                const keyword = state.keyword;
                if (!this.isSearchable(keyword.trim(), true)) return;
                event.preventDefault();
                return this.search(keyword, true);
            },
            startComposition() {
                // Suspend pending searches while the input method is assembling text.
                composing = true;
                this.queueSearch();
            },
            endComposition() {
                // Resume debouncing with the committed input.
                composing = false;
                this.queueSearch();
            },
            cancelSearch() {
                // Cancel both scheduled and in-flight work before accepting a new expression.
                if (debounceId !== null) clearTimeout(debounceId);
                debounceId = null;
                request?.controller.abort();
                request = null;
            },
            queueSearch() {
                // Cancel active work immediately and schedule only the latest eligible keyword.
                if (!alive) return;
                this.cancelSearch();
                state.loading = false;
                state.noResults = false;
                if (composing) return;
                const keyword = state.keyword;
                if (!this.isSearchable(keyword.trim())) {
                    state.searched = "";
                    state.results = [];
                    state.errors = [];
                    state.errorMessage = "";
                    return;
                }
                debounceId = setTimeout(() => {
                    debounceId = null;
                    this.search(keyword);
                }, 200);
            },
            async search(keyword = state.keyword, explicit = false) {
                // Publish only the response associated with the latest live Page request.
                const expression = keyword.trim();
                if (!alive || composing || !this.isSearchable(expression, explicit) || request?.expression === expression) return;
                this.cancelSearch();
                const currentRequest = {expression, controller: new AbortController()};
                request = currentRequest;
                const {signal} = currentRequest.controller;
                state.loading = true;
                state.noResults = false;
                state.errors = [];
                state.errorMessage = "";
                try {
                    const response = await search.query(keyword, {signal});
                    if (!alive || signal.aborted) return;
                    state.searched = expression;
                    state.results = response.results;
                    state.errors = response.errors;
                    state.errorMessage = response.errors.map(error => error.message).join(" ");
                    state.noResults = response.results.length === 0 && response.errors.length === 0;
                } catch (error) {
                    if (!alive || signal.aborted || error?.name === "AbortError") return;
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
                this.cancelSearch();
            }
        };
    }
};
