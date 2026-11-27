
export default {
    meta: {
        title: "Module References",
        description: "Reference external Module definitions and inspect their resolved runtime instances."
    },

    template: `
        <p>The Cookbook declares Module dependencies by ID and version selector. The host's repositories supply the matching manifests.</p>

        <h2>Local definition versus reference</h2>
        <x-code language="json" x-pre>{
    "modules": {
        "x-demo": {
            "label": "XShell Cookbook",
            "version": "0.9.0",
            "dependencies": {
                "x": "module:x:latest",
                "x-filesystem": "module:x-filesystem:latest"
            }
        }
    }
}</x-code>
        <p><code>x-demo</code> is the root Module. Its <code>dependencies</code> declare the Modules it needs.</p>

        <h2>Reference resolution</h2>
        <p>During bootstrap, XShell follows dependencies from the repository indexes and loads the selected manifests. The effective <code>configUrl</code> records the selected manifest URL for each Module.</p>

        <h2>Referenced Modules in this application</h2>
        <p>The following values come from the effective configuration and runtime Module registry.</p>
        <div x-for="item in state.items" x-key="id">
            <h3>{{ item.id }} — {{ item.label }}</h3>
            <x-datafields columns="2">
                <x-datafield label="Definition URL">{{ item.configUrl }}</x-datafield>
                <x-datafield label="Runtime instance">{{ item.instance }}</x-datafield>
                <x-datafield label="Virtual asset path">{{ item.assetsPath }}</x-datafield>
                <x-datafield label="Inventory entries">{{ item.fileCount }}</x-datafield>
            </x-datafields>
        </div>

        <h2>References and resource dependencies</h2>
        <p>Module references make a Module's definition and resources available to the application. A Page's <code>dependencies</code> property requests particular resources from those Modules.</p>
        <x-code language="javascript" x-pre>// Root Module definition:
"dependencies": {
    "x": "module:x:latest"
}

// Individual Page:
dependencies: {
    button: "component:x-button",
    icon: "icon:x-file"
}</x-code>
        <p>These mechanisms operate at different levels: Module discovery happens during bootstrap, while resource dependencies are loaded for a particular Page or Component.</p>

        <h2>References and Areas</h2>
        <p>Module dependencies determine which resources are available. The Cookbook Area exposes resources through its selected menus and configured routes.</p>

        <p>Continue with <x-anchor href="03-resources.js">Module Resources</x-anchor> to learn what a Module exposes.</p>
    `,

    state: {
        items: []
    },

    controller({config, modules, state}) {
        return {
            load() {
                state.items = ["x", "x-filesystem", "xshell-docs"].map(id => {
                    const definition = config.modules[id];
                    const instance = modules.getModuleById(id);

                    return {
                        id,
                        label: definition?.label || id,
                        configUrl: definition?.configUrl || "Unavailable",
                        instance: instance?.id || "Unavailable",
                        assetsPath: definition?.assets?.path || "",
                        fileCount: definition?.files?.length || 0
                    };
                });
            }
        };
    }
};
