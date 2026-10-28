const logKey = "x-demo2:page-lifecycle";

export default {
    meta: {
        title: "Page Lifecycle",
        description: "Observe controller construction, load, mount, unmount, and unload."
    },

    template: `
        <p>The Page loader constructs the controller, then <code>x-page</code> loads and mounts the Page. Leaving this destination unmounts and unloads it.</p>
        <p>The log is kept in this tab so the last Page's final hooks are visible when you return.</p>
        <x-button label="Clear log" command="clearLog"></x-button>
        <ol><li x-for="item in state.events">{{ item }}</li></ol>
        <p><x-anchor href="04-state.js">Navigate to Page State</x-anchor>, then return here to see <code>unmount</code> and <code>unload</code>.</p>
        <p>Loader lifecycle orchestration invokes these controller hooks; render and state engines keep their separate responsibilities.</p>
    `,

    state: { events: [] },

    controller({ state }) {
        const read = () => {
            try {
                const value = JSON.parse(sessionStorage.getItem(logKey) || "[]");
                return Array.isArray(value) ? value : [];
            }
            catch { return []; }
        };
        const record = event => {
            const events = [...read(), event].slice(-20);
            try { sessionStorage.setItem(logKey, JSON.stringify(events)); }
            catch { /* The current Page can still show the event. */ }
            state.events = events;
        };
        record("controller constructed");
        return {
            load() { record("load"); },
            mount() { record("mount"); },
            unmount() { record("unmount"); },
            unload() { record("unload"); },
            clearLog() {
                try { sessionStorage.removeItem(logKey); }
                catch { /* Storage may be unavailable. */ }
                state.events = [];
            }
        };
    }
};
