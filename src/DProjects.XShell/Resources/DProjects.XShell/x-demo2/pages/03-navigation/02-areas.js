export default {
    meta: {
        title: "Areas and Menus",
        description: "An Area composes module menus into a navigation context."
    },

    template: `
        <p>An Area composes module menus into a navigation context.</p>
        <p>Current Area: {{ state.area }}</p>
        <p>Area count: {{ state.count }}</p>        
    `,

    state: {
        area: "",
        count: 0
    },

    controller({ areas, state }) {
        return {
            load() {
                state.area = areas.getCurrentArea()?.label || "";
                state.count = areas.getAreas().length;
            }
        };
    }
};
