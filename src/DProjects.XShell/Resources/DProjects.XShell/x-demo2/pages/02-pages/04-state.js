export default {
    meta: {
        title: "Page State",
        description: "Private state rerenders the template when changed."
    },

    template: `
        <p>Private state rerenders the template when changed.</p>
        <p>Count: {{ state.count }}</p>
        <x-button label="Increase" command="increase"></x-button>
        <x-button label="Reset" command="reset"></x-button>        
    `,

    state: {
        count: 0
    },

    controller({ state }) {
        return {
            increase() {
                state.count += 1;
            },

            reset() {
                state.count = 0;
            }
        };
    }
};
