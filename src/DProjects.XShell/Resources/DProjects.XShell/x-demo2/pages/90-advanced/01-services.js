export default {
    meta: { title: "Injected Services", description: "Controllers receive configured runtime services by name." },
    template: `
        <p>Controllers receive configured runtime services by name.</p>
        <p>Navigation mode: {{ state.mode }}</p>
        <p>Current Area: {{ state.area }}</p>
        
    `,
    state: { mode: "", area: "" },
    controller({ navigation, areas, state }) {
        return { load() { state.mode = navigation.mode; state.area = areas.getCurrentArea()?.label || ""; } };
    }
};
