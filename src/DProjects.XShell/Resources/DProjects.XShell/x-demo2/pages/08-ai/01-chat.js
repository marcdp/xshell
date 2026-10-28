export default {
    meta: {
        title: "Simulated Chat",
        description: "The chat component renders messages; this Page supplies deterministic local replies."
    },

    template: `
        <p>The chat component renders messages; this Page supplies deterministic local replies.</p>
        <x-chat x-prop:messages="state.messages" x-on:send="send" placeholder="Ask a question"></x-chat>
        <x-button label="Clear" command="clear"></x-button>
    `,

    state: {
        messages: [{ id: "1", role: "assistant", content: "Hello from the local demo.", status: "complete" }]
    },

    controller({ state }) {
        let nextId = 1;
        return {
            send({ event }) {
                const content = event.detail?.content?.trim();
                if (!content) {
                    return;
                }

                state.messages = [
                    ...state.messages,
                    { id: String(++nextId), role: "user", content, status: "complete" },
                    { id: String(++nextId), role: "assistant", content: "You wrote: " + content, status: "complete" }
                ];
            },

            clear() {
                state.messages = [];
            }
        };
    }
};
