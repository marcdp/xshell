
export default {
    meta: {
        title: "Event Bus",
        description: "Demonstrates publishing, subscribing, event payloads."
    },

    template: `
        <p>The XShell Event Bus enables communication between Pages, Components, Modules, and services without direct references between publishers and subscribers. Events are asynchronous, named notifications.</p>

        <h2>Publishing events</h2>
        <p>Use <code>bus.emit()</code> to publish an event with a name and a detail payload.</p>
        <p>
            <x-button label="Publish event" command="publish"></x-button>
            <x-button label="Publish another event" command="publishOther"></x-button>
        </p>
        <pre x-pre><code>bus.emit("x-demo:example", {
    message: "Hello from XShell",
    count: 1
});</code></pre>

        <h2>Subscribing to events</h2>
        <p>Use the injected <code>events</code> helper to register a listener. The helper manages the listener's lifecycle and removes it automatically when the Page unloads.</p>
        <p>Events received: <strong>{{ state.count }}</strong></p>
        <p>Last message: <strong>{{ state.lastMessage }}</strong></p>
        <pre x-pre><code>controller({bus, events, state}) {
    const receive = event => {
        state.count++;
        state.lastMessage = event.detail.message;
    };

    return {
        load() {
            events.on(bus, "x-demo:example", receive);
        }
    };
}</code></pre>

        <h2>Event structure</h2>
        <p>Each listener receives an object containing the event name, the emission timestamp, and the payload.</p>
        <x-datafields columns="2">
            <x-datafield label="Event type">{{ state.lastType }}</x-datafield>
            <x-datafield label="Timestamp">{{ state.lastTimestamp }}</x-datafield>
        </x-datafields>
        <x-json x-prop:value="state.lastDetail"></x-json>
        <pre x-pre><code>{
    type: "x-demo:example",
    ts: 1234567890,
    detail: {
        message: "Hello from XShell",
        count: 1
    }
}</code></pre>
        <p>The payload must be compatible with structured cloning because the Bus uses <code>MessageChannel</code> internally.</p>

        <h2>Multiple subscriptions</h2>
        <p>A Page can subscribe to several event names. Each subscription is managed independently by the same <code>events</code> helper.</p>
        <pre x-pre><code>load() {
    events.on(bus, "x-demo:example", receive);
    events.on(bus, "x-demo:other", receive);
}</code></pre>
        <p>Both event types in this example update the received-event counter and last-message fields.</p>

        <h2>Wildcard listeners</h2>
        <p>Use <code>"*"</code> to subscribe to all events published through the Bus.</p>
        <p>Wildcard notifications received: <strong>{{ state.wildcardCount }}</strong></p>
        <p>Last wildcard event: <strong>{{ state.lastWildcard }}</strong></p>
        <pre x-pre><code>events.on(bus, "*", event => {
    // Receives all Bus events.
});</code></pre>
        <p>Wildcard listeners also receive events from other parts of the application, not only events published by this Page.</p>

        <h2>Asynchronous delivery</h2>
        <p><code>bus.emit()</code> queues an event and returns immediately. Listeners are notified asynchronously, and their completion is not awaited.</p>
        <pre x-pre><code>bus.emit("x-demo:example", {message:"Hello"});

// The event is queued, not delivered synchronously.
// emit() does not return a completion Promise.</code></pre>
        <p>Use the Bus for notifications rather than request-response operations requiring an immediate result.</p>

        <h2>Bus versus DOM events</h2>
        <p>DOM events represent interactions with elements and may bubble through the document. Bus events are application-level notifications: they do not bubble through the DOM and cannot be cancelled.</p>
        <p>For element events, see <x-anchor href="../07-templates/05-events.js">Events and Models</x-anchor>. For dependency injection, see <x-anchor href="01-services.js">Services</x-anchor>.</p>
    `,

    state: {
        count: 0,
        nextCount: 1,
        wildcardCount: 0,
        lastMessage: "No events received",
        lastType: "None",
        lastTimestamp: "",
        lastDetail: null,
        lastWildcard: "None"
    },

    controller({bus, events, state}) {
        const eventName = "x-demo:example";
        const otherEventName = "x-demo:other";

        const receive = event => {
            state.count++;
            state.lastType = event.type;
            state.lastTimestamp = new Date(event.ts).toISOString();
            state.lastDetail = event.detail;
            state.lastMessage = event.detail?.message || "";
        };

        const receiveWildcard = event => {
            state.wildcardCount++;
            state.lastWildcard = event.type;
        };

        return {
            load() {
                events.on(bus, eventName, receive);
                events.on(bus, otherEventName, receive);
                events.on(bus, "*", receiveWildcard);
            },

            publish() {
                bus.emit(eventName, {
                    message: "Hello from XShell",
                    count: state.nextCount++
                });
            },

            publishOther() {
                bus.emit(otherEventName, {
                    message: "Another event type",
                    count: state.nextCount++
                });
            }
        };
    }
};
