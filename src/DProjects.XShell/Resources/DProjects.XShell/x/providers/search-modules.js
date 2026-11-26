export default class ModulesSearchProvider {

    // ctor
    constructor({modules}) {
        // Retain the metadata-only Modules registry without loading module resources.
        this.modules = modules;
    }

    // methods
    async query(text, {signal}) {
        // Project matching module metadata to the existing installed-modules inspection Page.
        const query = text.toLowerCase();
        const results = [];
        for (const module of this.modules.registry) {
            signal?.throwIfAborted();
            const searchable = [module.id, module.label, module.description, ...(module.tags || [])].join(" ").toLowerCase();
            if (!searchable.includes(query)) continue;
            results.push({
                id: module.id,
                label: module.label || module.id,
                ...(module.description ? {description: module.description} : {}),
                icon: module.icon || "x-module",
                category: "Modules",
                tags: [...(module.tags || [])],
                href: "page:x:/pages/preferences/modules.js",
                open: "stack"
            });
        }
        return results;
    }
}
