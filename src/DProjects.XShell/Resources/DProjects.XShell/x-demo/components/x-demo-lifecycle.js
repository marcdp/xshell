export const contract = {
    description: "A lifecycle probe that reports its controller hooks to the cookbook Page."
};

export default {
    template: `<p>Lifecycle probe is mounted.</p>`,

    controller({ bus }) {
        const report = stage => bus.emit("x-demo:component-lifecycle", { stage });
        return {
            load() { report("load"); },
            mount() { report("mount"); },
            unmount() { report("unmount"); },
            unload() { report("unload"); }
        };
    }
};
