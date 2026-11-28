const recordLimit = 200;

// page
export default {
    meta: {title: "Live Logs", description: "Monitor the latest persisted application logs."},
    style: `
        .log-filter {position:relative; margin-inline-end:.75em;}
        .log-filter > div {position:absolute; z-index:1; background:var(--x-color-background-page); border:1px solid var(--x-color-text-gray);
            padding:.5em; max-inline-size: min(22rem, 70vw); width:max-content; max-block-size:14em; overflow:auto;}
        .log-filter label, .log-filter small {display:block; overflow-wrap:anywhere;}
    `,
    template: `
        <form x-on:change="applyFilters">
            <x-toolbar aria-label="Live log controls">
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
                <span role="status" x-text="state.live ? 'Live' : 'Paused'"></span>
                <x-button x-attr:label="state.live ? 'Pause' : 'Resume'" x-on:click="toggleLive"></x-button>
                <x-button label="Refresh" x-on:click="refresh"></x-button>
                <label><input type="checkbox" x-model="state.autoScroll"> Auto-scroll</label>
            </x-toolbar>
        </form>
        <p role="status" x-if="state.loading">Loading logs…</p>
        <p role="alert" x-if="state.error" x-text="state.error"></p>
        <p role="alert" x-if="state.categoryError" x-text="state.categoryError"></p>
        <p role="alert" x-if="state.subscriptionError" x-text="state.subscriptionError"></p>
        <p role="status" x-if="!state.loading && !state.error && state.records.length == 0">No matching logs.</p>
        <x-logview x-prop:records="state.records" x-attr:auto-scroll="state.autoScroll"></x-logview>
    `,
    state: {records: [], live: true, autoScroll: true, loading: true, error: "", subscriptionError: "", categoryOptions: [], categoryError: ""},
    controller({state, page, logReader}) {
        let active = false, visible = false;
        let observer, subscription, categoryRequest;
        let generation = 0;
        let pending = false, running = false, scheduled = false;
        let filters = {};

        return {
            mount() {
                // Observe tab layout changes without tying monitoring to the scroll position.
                active = true;
                observer = new ResizeObserver(() => this.updateVisibility());
                observer.observe(page.host);
                this.updateVisibility();
                void this.discoverCategories();
            },
            unmount() {
                // Invalidate pending reads and release both established and late registrations.
                active = visible = false;
                observer?.disconnect();
                observer = categoryRequest = undefined;
                this.stopLive();
            },
            unload() {
                this.unmount();
            },
            updateVisibility() {
                // Hidden tab panels have no layout box. Keep explicit pause separate from visibility.
                if (!active) return;
                const shown = page.host.checkVisibility();
                if (shown === visible) return;
                visible = shown;
                if (!shown) this.stopLive();
                else if (state.live) void this.startLive();
            },
            async startLive() {
                // Queue the latest window, but wait for the subscription before starting the read.
                const registration = subscription = {ready: false};
                state.subscriptionError = "";
                this.requestRead();
                try {
                    const unsubscribe = await logReader.subscribe(() => {
                        if (subscription !== registration) return;
                        pending = true;
                        this.schedule();
                    });
                    if (subscription !== registration) unsubscribe();
                    else registration.unsubscribe = unsubscribe;
                } catch (error) {
                    if (subscription !== registration) return;
                    subscription = undefined;
                    state.live = false;
                    state.subscriptionError = error.message;
                } finally {
                    registration.ready = true;
                    this.schedule();
                }
            },
            stopLive() {
                // Clear the registration before releasing it so obsolete callbacks are inert.
                const registration = subscription;
                subscription = undefined;
                generation++;
                pending = false;
                registration?.unsubscribe?.();
            },
            toggleLive() {
                state.live = !state.live;
                if (state.live && visible) void this.startLive();
                else {
                    this.stopLive();
                    state.loading = false;
                }
            },
            applyFilters({event}) {
                // Only filter controls trigger a query; the follow checkbox affects presentation.
                if (!["category", "level"].includes(event.target.name)) return;
                const form = new FormData(event.currentTarget);
                const levels = form.getAll("level");
                const categories = form.getAll("category").map(value => JSON.parse(value));
                filters = {...(levels.length === 5 ? {} : {levels}), ...(categories.length ? {categories} : {})};
                this.requestRead();
            },
            refresh() {
                this.requestRead();
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
            requestRead() {
                // Explicit actions invalidate older responses and replace the queued request.
                generation++;
                pending = true;
                this.schedule();
            },
            schedule() {
                // Coalesce notifications and explicit actions before starting a single read.
                if (!active || !pending || running || scheduled || (subscription && !subscription.ready)) return;
                scheduled = true;
                queueMicrotask(() => {
                    scheduled = false;
                    void this.read();
                });
            },
            async read() {
                if (!active || !pending || running || (subscription && !subscription.ready)) return;

                // Changes arriving during the read leave a single follow-up reconciliation pending.
                const version = generation;
                pending = false;
                running = true;
                try {
                    const result = await logReader.query({...filters, limit: recordLimit, order: "desc"});
                    if (generation !== version) return;
                    state.records = result.items.toReversed();
                    state.error = "";
                } catch (error) {
                    if (generation === version) state.error = error.message;
                } finally {
                    if (generation === version) {
                        state.loading = false;
                        if (state.subscriptionError === state.error) state.subscriptionError = "";
                    }
                    running = false;
                    this.schedule();
                }
            }
        };
    }
};
