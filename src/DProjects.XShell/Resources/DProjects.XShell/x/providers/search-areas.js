export default class AreasSearchProvider {

    // ctor
    constructor({areas, config}) {
        // Retain metadata-only Services used to inspect effective Area navigation.
        this.areas = areas;
        this.config = config;
    }

    // methods
    async query(text, {signal}) {
        // Search the current Area first, then the remaining effective Area navigation menus.
        const query = text.toLowerCase();
        const current = this.areas.getCurrentArea();
        const areas = [...this.areas.getAreas()].sort((left, right) => left.id === current?.id ? -1 : right.id === current?.id ? 1 : 0);
        const results = [];
        for (const area of areas) {
            signal?.throwIfAborted();
            const menu = this.areas.getMenu("navigation", area.id);
            if (!menu || menu.scope !== "area") continue;
            this.collect(menu.items, area, query, results, signal);
        }
        signal?.throwIfAborted();
        return results;
    }
    collect(items, area, query, results, signal) {
        // Traverse effective items depth-first while excluding groups, separators, and unsupported embedded destinations.
        for (const item of items || []) {
            signal?.throwIfAborted();
            const label = typeof item.label === "string" ? item.label.trim() : "";
            const href = [item.path, item.href].find(value => typeof value === "string" && value.trim())?.trim() || "";
            const searchable = [item.label, item.description, item.path, item.href].filter(value => typeof value === "string").join(" ").toLowerCase();
            if (href && label && label !== "-" && item.open !== "embed" && searchable.includes(query)) {
                results.push({
                    id: `${area.id}:${href}`,
                    label,
                    ...(item.description ? {description: item.description} : {}),
                    icon: item.icon || this.config.modules[item.module]?.icon || area.icon || "x-page",
                    category: area.label || area.id,
                    href,
                    open: ["top", "stack", "dialog", "dock"].includes(item.open) ? item.open : "top"
                });
            }
            this.collect(item.children, area, query, results, signal);
        }
    }
}
