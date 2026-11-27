// page
export default {
    meta: {title: "Logs", description: "Browse stored application logs and monitor new records."},
    style: `
        .log-actions, .log-dates {display:flex; flex-wrap:wrap; align-items:center; gap:.5em;}
        .log-filters {margin-block-end:1em;}
        .log-filters label {margin-inline-end:.75em;}
        .log-dates {margin-block:.5em;}
        .logs {list-style:none; padding:0;}
        .logs li {margin-block:.5em;}
        .logs summary {cursor:pointer; overflow-wrap:anywhere;}
        .logs time, .logs strong {margin-inline-end:.5em;}
    `,
    template: `
        <form class="log-filters" x-on:submit="applyFilters">
            <fieldset>
                <legend>Severity</legend>
                <label><input type="checkbox" name="level" value="trace" x-prop:checked="state.levels.trace"> Trace</label>
                <label><input type="checkbox" name="level" value="debug" x-prop:checked="state.levels.debug"> Debug</label>
                <label><input type="checkbox" name="level" value="info" x-prop:checked="state.levels.info"> Info</label>
                <label><input type="checkbox" name="level" value="warn" x-prop:checked="state.levels.warn"> Warn</label>
                <label><input type="checkbox" name="level" value="error" x-prop:checked="state.levels.error"> Error</label>
            </fieldset>
            <div class="log-dates">
                <label>From (local time) <input type="datetime-local" name="from" step="0.001" x-prop:value="state.from"></label>
                <label>To (local time) <input type="datetime-local" name="to" step="0.001" x-prop:value="state.to"></label>
                <button type="submit">Apply filters</button>
            </div>
        </form>
        <div class="log-actions">
            <x-button x-attr:label="state.live ? 'Pause live' : 'Resume live'" x-on:click="toggleLive"></x-button>
            <x-button label="Refresh" x-on:click="refresh"></x-button>
            <x-button label="Newer" x-attr:disabled="state.loading || state.pageIndex == 0" x-on:click="newer"></x-button>
            <x-button label="Older" x-attr:disabled="state.loading || !state.hasMore" x-on:click="older"></x-button>
            <span x-text="state.live ? 'Live' : 'Paused'"></span>
            <span x-text="'Page ' + (state.pageIndex + 1)"></span>
        </div>
        <p role="status" x-if="state.loading">Loading logsâ€¦</p>
        <p role="alert" x-if="state.error" x-text="state.error"></p>
        <p role="alert" x-if="state.subscriptionError" x-text="state.subscriptionError"></p>
        <p role="status" x-if="!state.loading && !state.error && state.rows.length == 0">No matching logs.</p>
        <ol class="logs" aria-label="Log records">
            <li x-for="row in state.rows" x-key="id">
                <details x-attr:data-id="row.id" x-on:toggle="inspect">
                    <summary><time x-attr:datetime="row.iso" x-text="row.time"></time> <strong x-text="row.level"></strong> <span x-text="row.preview"></span></summary>
                    <x-object x-if="row.id == state.inspectedId" name="Arguments" expanded x-prop:value="state.inspectedArgs"></x-object>
                </details>
            </li>
        </ol>
    `,
    state: {
        live: true, loading: true, error: "", subscriptionError: "", pageIndex: 0, hasMore: false, rows: [],
        levels: {trace: true, debug: true, info: true, warn: true, error: true},
        from: "", to: "", inspectedId: null, inspectedArgs: null
    },
    controller({state, logReader}) {
        let active = false;
        let subscription;
        let generation = 0;
        let pending;
        let running = false;
        let dirty = false;
        let scheduled = false;
        let filters = {};
        let cursors = [undefined];
        let openDetails;

        return {
            mount() {
                // Start observing only while mounted and register before querying the live page.
                active = true;
                if (state.live) void this.startLive();
                this.requestPage(state.pageIndex);
            },
            unmount() {
                // Ignore in-flight work and release both active and pending subscriptions.
                active = false;
                generation++;
                pending = undefined;
                this.stopLive();
                openDetails = undefined;
                state.inspectedId = state.inspectedArgs = null;
            },
            unload() {
                // Also cover disposal without a preceding unmount.
                this.unmount();
            },
            async startLive() {
                // Tie the eventual unsubscribe function to this specific registration attempt.
                const registration = {ready: false};
                subscription = registration;
                state.subscriptionError = "";
                try {
                    const unsubscribe = await logReader.subscribe(() => {
                        if (!active || subscription !== registration) return;
                        dirty = true;
                        this.schedule();
                    });
                    if (!active || subscription !== registration) {
                        unsubscribe();
                        return;
                    }
                    registration.unsubscribe = unsubscribe;
                } catch (error) {
                    if (!active || subscription !== registration) return;
                    subscription = undefined;
                    state.live = false;
                    state.subscriptionError = error.message;
                } finally {
                    registration.ready = true;
                    this.schedule();
                }
            },
            stopLive() {
                // Clear the token before calling out so late callbacks are ignored.
                const registration = subscription;
                subscription = undefined;
                dirty = false;
                registration?.unsubscribe?.();
            },
            toggleLive() {
                // Keep historical queries independent of the live refresh loop.
                state.live = !state.live;
                if (state.live) {
                    void this.startLive();
                    this.requestPage(0);
                } else {
                    this.stopLive();
                    this.schedule();
                }
            },
            applyFilters({event}) {
                // Apply severity and local date bounds as one query and discard incompatible cursors.
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const levels = form.getAll("level");
                state.levels = Object.fromEntries(Object.keys(state.levels).map(level => [level, levels.includes(level)]));
                state.from = form.get("from");
                state.to = form.get("to");
                filters = {
                    levels,
                    ...(state.from ? {from: new Date(state.from).getTime()} : {}),
                    ...(state.to ? {to: new Date(state.to).getTime()} : {})
                };
                this.requestPage(0);
            },
            refresh() { this.requestPage(state.pageIndex); },
            newer() { if (!state.loading && state.pageIndex > 0) this.browse(state.pageIndex - 1); },
            older() { if (!state.loading && state.hasMore) this.browse(state.pageIndex + 1); },
            browse(index) {
                // Pause observation for historical browsing. Resume always returns to the newest page.
                state.live = false;
                this.stopLive();
                this.requestPage(index);
            },
            inspect({event}) {
                // Keep only the disclosure opened by the user and pass raw arguments to the object inspector.
                const details = event.currentTarget;
                const row = state.rows.find(item => String(item.id) === details.dataset.id);
                if (!row) return;
                if (details.open) {
                    if (openDetails && openDetails !== details) openDetails.open = false;
                    openDetails = details;
                    state.inspectedArgs = row.args;
                    state.inspectedId = row.id;
                } else if (state.inspectedId === row.id) {
                    openDetails = undefined;
                    state.inspectedId = state.inspectedArgs = null;
                }
            },
            requestPage(index) {
                // Replace queued user requests and prevent any older result from changing the view.
                if (index === 0) cursors = [undefined];
                generation++;
                pending = {index, version: generation};
                state.pageIndex = index;
                state.loading = true;
                state.error = "";
                this.schedule();
            },
            schedule() {
                // Coalesce requests before the next query and wait for subscription registration in live mode.
                if (!active || scheduled) return;
                scheduled = true;
                queueMicrotask(() => {
                    scheduled = false;
                    void this.read();
                });
            },
            async read() {
                if (!active || running || (subscription && !subscription.ready)) return;
                const request = pending ?? (state.live && dirty ? {index: 0, version: generation, automatic: true} : null);
                if (!request) return;

                // Keep notifications that arrive during the read for one follow-up reconciliation.
                if (!pending) dirty = false;
                pending = undefined;
                running = true;
                const {index, version, automatic} = request;
                const current = () => active && generation === version && (!automatic || state.live);
                const cursor = cursors[index];
                try {
                    const result = await logReader.query({...filters, ...(cursor == null ? {} : {cursor}), order: "desc"});
                    if (!current()) return;
                    const rows = result.items.map(item => this.present(item));
                    if (!rows.some(row => row.id === state.inspectedId)) this.clearInspection();
                    state.rows = rows;
                    state.error = "";
                    state.hasMore = result.hasMore;
                    cursors[index + 1] = result.nextCursor;
                    cursors.length = index + 2;
                } catch (error) {
                    if (!current()) return;
                    this.clearInspection();
                    state.rows = [];
                    state.hasMore = false;
                    state.error = error.message;
                } finally {
                    if (current()) {
                        state.loading = false;
                        if (state.subscriptionError === state.error) state.subscriptionError = "";
                    }
                    running = false;
                    this.schedule();
                }
            },
            clearInspection() {
                // Release the DOM node and arguments when its record leaves the page.
                openDetails = undefined;
                state.inspectedId = state.inspectedArgs = null;
            },
            present({id, timestamp, level, args}) {
                // Display a bounded, text-only preview while keeping the stored argument array intact.
                const date = new Date(timestamp);
                const validDate = Number.isFinite(date.getTime());
                const value = args[0];
                let preview;
                if (!args.length) preview = "(no arguments)";
                else if (value instanceof Error) preview = value.name + ": " + value.message;
                else if (Array.isArray(value)) preview = "Array(" + value.length + ")";
                else if (value && typeof value === "object") preview = value.unserializable === true ? "[Unserializable]" : Object.prototype.toString.call(value);
                else preview = typeof value === "bigint" ? String(value) + "n" : String(value);
                if (preview.length > 240) preview = preview.slice(0, 239) + "â€¦";
                return {id, level, args, preview, time: validDate ? date.toLocaleString() : String(timestamp), iso: validDate ? date.toISOString() : ""};
            }
        };
    }
};
