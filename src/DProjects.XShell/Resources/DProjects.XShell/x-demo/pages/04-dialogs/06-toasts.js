
export default {
    meta: {
        title: "Toasts",
        description: "Demonstrates toast notifications, durations, scopes, and lifecycle events."
    },

    template: `
        <p>Use the <code>toast</code> service to display non-blocking notifications.
        Unlike message dialogs, toasts do not interrupt the user or require acknowledgment.</p>

        <h2>Toast types</h2>
        <p>Toasts support four types: information, success, warning, and error.</p>
        <p>
            <x-button label="Information" command="showInfo"></x-button>
            <x-button label="Success" command="showSuccess"></x-button>
            <x-button label="Warning" command="showWarning"></x-button>
            <x-button label="Error" command="showError"></x-button>
        </p>
        <x-code language="javascript" x-pre>toast.show("Operation completed", {
    type: "success",
    duration: 4000
});</x-code>

        <h2>Duration</h2>
        <p>The <code>duration</code> option controls automatic dismissal in milliseconds.
        A value of <code>0</code> creates a persistent toast.</p>
        <p>
            <x-button label="2 seconds" command="showShort"></x-button>
            <x-button label="5 seconds" command="showLong"></x-button>
            <x-button label="Persistent" command="showPersistent"></x-button>
        </p>
        <x-code language="javascript" x-pre>toast.show("Persistent notification", {
    type: "info",
    duration: 0
});</x-code>

        <h2>Toast scope</h2>
        <p>Application-scoped toasts appear globally. Page-scoped toasts belong
        to the current Page and are automatically removed when that Page closes or is replaced.</p>
        <p>
            <x-button label="Application toast" command="showApplication"></x-button>
            <x-button label="Page toast" command="showPage"></x-button>
        </p>
        <x-code language="javascript" x-pre>// Application scope
toast.show("Global notification");

// Page scope
toast.show("Page notification", {
    page,
    type: "info"
});</x-code>

        <h2>Managing toasts</h2>
        <p><code>show()</code> returns a toast identifier that can be passed to
        <code>close()</code>. Use <code>clear()</code> to dismiss all visible toasts.</p>
        <p>Last toast ID: <strong>{{ state.lastId }}</strong></p>
        <p>
            <x-button label="Close last toast" command="closeLast"></x-button>
            <x-button label="Clear page toasts" command="clearPage"></x-button>
            <x-button label="Clear all toasts" command="clearAll"></x-button>
        </p>
        <x-code language="javascript" x-pre>const id = toast.show("Hello", {
    duration: 0
});

toast.close(id);
toast.clear(page);
toast.clear();</x-code>

        <h2>Lifecycle events</h2>
        <p>The Toast service dispatches <code>shown</code> and <code>closed</code>
        DOM events. Each event contains the toast identifier in <code>event.detail.id</code>.</p>
        <x-datafields columns="2">
            <x-datafield label="Shown events">{{ state.shownCount }}</x-datafield>
            <x-datafield label="Closed events">{{ state.closedCount }}</x-datafield>
            <x-datafield label="Last event">{{ state.lastEvent }}</x-datafield>
            <x-datafield label="Event toast ID">{{ state.eventId }}</x-datafield>
        </x-datafields>
        <x-code language="javascript" x-pre>events.on(toast, "shown", event => {
    console.log("Toast shown:", event.detail.id);
});

events.on(toast, "closed", event => {
    console.log("Toast closed:", event.detail.id);
});</x-code>

        <h2>Toast versus message dialogs</h2>
        <p>Use toasts for transient feedback, such as saving a record or completing
        an operation. Use <x-anchor href="01-messages.js">message dialogs</x-anchor>
        when the user must acknowledge important information.</p>
    `,

    state: {
        lastId: "",
        shownCount: 0,
        closedCount: 0,
        lastEvent: "None",
        eventId: ""
    },

    controller({toast, page, events, state}) {
        const show = (message, options = {}) => {
            state.lastId = toast.show(message, options);
        };

        return {
            load() {
                events.on(toast, "shown", event => {
                    state.shownCount++;
                    state.lastEvent = "shown";
                    state.eventId = event.detail.id;
                });

                events.on(toast, "closed", event => {
                    state.closedCount++;
                    state.lastEvent = "closed";
                    state.eventId = event.detail.id;
                });
            },

            showInfo() {
                show("This is an informational notification.", {
                    type: "info"
                });
            },

            showSuccess() {
                show("The operation completed successfully.", {
                    type: "success"
                });
            },

            showWarning() {
                show("Some information requires attention.", {
                    type: "warning"
                });
            },

            showError() {
                show("The operation could not be completed.", {
                    type: "error"
                });
            },

            showShort() {
                show("This toast disappears after 2 seconds.", {
                    duration: 2000
                });
            },

            showLong() {
                show("This toast disappears after 5 seconds.", {
                    duration: 5000
                });
            },

            showPersistent() {
                show("This notification stays until dismissed.", {
                    type: "info",
                    duration: 0
                });
            },

            showApplication() {
                show("Application-scoped notification.", {
                    type: "success",
                    duration: 4000
                });
            },

            showPage() {
                show("Page-scoped notification.", {
                    type: "info",
                    duration: 4000,
                    page
                });
            },

            closeLast() {
                if (state.lastId) {
                    toast.close(state.lastId);
                    state.lastId = "";
                }
            },

            clearPage() {
                toast.clear(page);
                state.lastId = "";
            },

            clearAll() {
                toast.clear();
                state.lastId = "";
            }
        };
    }
};
