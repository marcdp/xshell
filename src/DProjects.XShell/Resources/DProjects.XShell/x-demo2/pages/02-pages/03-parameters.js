export const contract = {
    properties: {
        name: {
            type: "string",
            default: "Ada",
            query: true,
            state: true
        },
        count: {
            type: "number",
            default: 1,
            query: true,
            state: true,
            reflect: true
        }
    }
};

export default {
    meta: {
        title: "Page Parameters",
        description: "The public contract declares query-backed properties; a controller can also read raw query values."
    },

    template: `
        <p>The public contract declares query-backed properties; a controller can also read raw query values.</p>
        <p>Name: {{ state.name }}</p>
        <p>Count: {{ state.count }}</p>
        <x-button label="Increment" command="increment"></x-button>
        <p><x-anchor href="03-parameters.js?name=Grace&amp;count=7">Open with query values</x-anchor></p>
        <p>Route example: <x-anchor href="/cookbook/hello/Ada">Hello Ada</x-anchor></p>
        
    `,

    controller({ state }) {
        return {
            increment() {
                state.count += 1;
            }
        };
    }
};
