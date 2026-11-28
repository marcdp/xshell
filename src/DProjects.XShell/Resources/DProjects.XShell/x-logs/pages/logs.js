// page
export default {
    meta: {title: "Logs", description: "Query and inspect stored application logs."},
    style: `
        .log-filter {position:relative; margin-inline-end:.75em;}
        .log-filter > div {position:absolute; z-index:1; background:var(--x-color-background-page); border:1px solid var(--x-color-text-gray);
            padding:.5em; max-inline-size: min(22rem, 70vw); width:max-content; max-block-size:14em; overflow:auto;}
        .log-filter label, .log-filter small {display:block; overflow-wrap:anywhere;}
        .log-dates {display:flex; flex-wrap:wrap; gap:.5em; margin-block:.5em;}
    `,
    template: `
        <form x-on:submit="applyFilters">
            <x-toolbar aria-label="Log query">
                <details class="log-filter">
                    <summary>Categories</summary>
                    <div>
                        <label x-for="option in state.categoryOptions" x-key="value">
                            <input type="checkbox" name="category" x-prop:value="option.value" x-model="option.checked">
                            <span x-text="option.label"></span>
                        </label>
                        <small>Clear all selections to show all categories.</small>
                    </div>
                </details>
                <details class="log-filter">
                    <summary>Levels</summary>
                    <div>
                        <label><input type="checkbox" name="level" value="trace" checked> Trace</label>
                        <label><input type="checkbox" name="level" value="debug" checked> Debug</label>
                        <label><input type="checkbox" name="level" value="info" checked> Info</label>
                        <label><input type="checkbox" name="level" value="warn" checked> Warn</label>
                        <label><input type="checkbox" name="level" value="error" checked> Error</label>
                    </div>
                </details>
                <details>
                    <summary>Date range</summary>
                    <div class="log-dates">
                        <label>From <input type="datetime-local" name="from" step="0.001"></label>
                        <label>To <input type="datetime-local" name="to" step="0.001"></label>
                    </div>
                </details>
                <button type="submit">Query</button>
                <x-button label="Refresh" x-on:click="refresh"></x-button>
            </x-toolbar>
        </form>
        <p role="status" x-if="state.loading">Loading logs…</p>
        <p role="alert" x-if="state.error" x-text="state.error"></p>
        <p role="alert" x-if="state.categoryError" x-text="state.categoryError"></p>
        <p role="status" x-if="!state.loading && !state.error && state.records.length == 0">No matching logs.</p>
        <x-logview x-prop:records="state.records"></x-logview>
        <x-toolbar aria-label="Log pages">
            <x-button label="Newer" x-attr:disabled="state.loading || state.pageIndex == 0" x-on:click="newer"></x-button>
            <span x-text="'Page ' + (state.pageIndex + 1)"></span>
            <x-button label="Older" x-attr:disabled="state.loading || !state.hasMore" x-on:click="older"></x-button>
        </x-toolbar>
    `,
    state: {records: [], loading: true, error: "", categoryOptions: [], categoryError: "", pageIndex: 0, hasMore: false},
    controller({state, logReader}) {
        let active = false;
        let queryRequest, categoryRequest;
        let filters = {};
        let cursors = [undefined];

        return {
            mount() {
                // Load the current historical page once on mount.
                active = true;
                this.refresh();
            },
            unmount() {
                // Invalidate both pending operations when the Page leaves its host.
                active = false;
                queryRequest = categoryRequest = undefined;
            },
            unload() {
                this.unmount();
            },
            applyFilters({event}) {
                // Read pending controls only on submit and start a new cursor history.
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const levels = form.getAll("level");
                const categories = form.getAll("category").map(value => JSON.parse(value));
                const from = form.get("from"), to = form.get("to");
                filters = {
                    ...(levels.length === 5 ? {} : {levels}),
                    ...(categories.length ? {categories} : {}),
                    ...(from ? {from: new Date(from).getTime()} : {}),
                    ...(to ? {to: new Date(to).getTime()} : {})
                };
                cursors = [undefined];
                state.pageIndex = 0;
                state.hasMore = false;
                this.read(0);
            },
            refresh() {
                // Refresh the applied query and discover new category choices independently.
                this.read(state.pageIndex);
                void this.discoverCategories();
            },
            async discoverCategories() {
                // Refresh on mount or explicit request and retain applied and pending selections after retention.
                if (!active || categoryRequest) return;
                const request = categoryRequest = {};
                try {
                    const categories = await logReader.getCategories();
                    if (categoryRequest !== request) return;
                    const checked = new Set(state.categoryOptions.filter(option => option.checked).map(option => option.value));
                    const options = new Set([...categories, ...(filters.categories ?? []), ...[...checked].map(value => JSON.parse(value))]);
                    state.categoryOptions = [...options].map(category => {
                        const value = JSON.stringify(category);
                        return {value, label: category === "Uncategorized" ? "Uncategorized (named category)" : category ?? "Uncategorized", checked: checked.has(value)};
                    });
                    state.categoryError = "";
                } catch (error) {
                    if (categoryRequest === request) state.categoryError = error.message;
                } finally {
                    if (categoryRequest === request) categoryRequest = undefined;
                }
            },
            newer() { if (!state.loading && state.pageIndex > 0) this.read(state.pageIndex - 1); },
            older() { if (!state.loading && state.hasMore) this.read(state.pageIndex + 1); },
            async read(index) {
                if (!active) return;

                // Only the most recent request may commit a page and its next cursor.
                const request = queryRequest = {};
                state.loading = true;
                state.error = "";
                const cursor = cursors[index];
                try {
                    const result = await logReader.query({...filters, ...(cursor == null ? {} : {cursor}), limit: 100, order: "desc"});
                    if (queryRequest !== request) return;
                    state.records = result.items;
                    state.pageIndex = index;
                    state.hasMore = result.hasMore;
                    cursors[index + 1] = result.nextCursor;
                    cursors.length = index + 2;
                } catch (error) {
                    if (queryRequest === request) state.error = error.message;
                } finally {
                    if (queryRequest === request) state.loading = false;
                }
            }
        };
    }
};
