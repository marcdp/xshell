
export default {
    meta: {
        title: "Module References",
        description: "Reference external Module definitions and inspect their resolved runtime instances."
    },

    template: `
        <p>An application can include Modules defined in other directories. Instead of repeating their configuration, it references their <code>module.jsonc</code> files using <code>configUrl</code>.</p>

        <h2>Local definition versus reference</h2>
        <pre x-pre><code>{
    "modules": {
        "x-demo": {
            "label": "XShell Cookbook",
            "version": "1.0.0"
        },
        "x": {
            "configUrl": "url:../x/module.jsonc"
        },
        "x-filesystem": {
            "configUrl": "url:../x-filesystem/module.jsonc"
        }
    }
}</code></pre>
        <p><code>x-demo</code> is defined locally. The entries containing <code>configUrl</code> point to other Module definitions.</p>

        <h2>Reference resolution</h2>
        <p>During bootstrap, XShell follows Module references, reads their definitions, and prepares effective configuration for each canonical Module ID.</p>
        <pre x-pre><code>Application module.jsonc
    |
    +-- x-demo         local definition
    |
    +-- x              ../x/module.jsonc
    |
    +-- x-filesystem   ../x-filesystem/module.jsonc
    |
    +-- xshell-docs    ../xshell-docs/module.jsonc</code></pre>

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
        <pre x-pre><code>// Application configuration:
"x": {
    "configUrl": "url:../x/module.jsonc"
}

// Individual Page:
dependencies: {
    button: "component:x-button",
    icon: "icon:x-file"
}</code></pre>
        <p>These mechanisms operate at different levels: Module discovery happens during bootstrap, while resource dependencies are loaded for a particular Page or Component.</p>

        <h2>References and Areas</h2>
        <p>Referencing a Module does not automatically add it to an Area's navigation. The cookbook Area includes <code>x-demo</code>, even though other Modules are available as resource providers.</p>

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
