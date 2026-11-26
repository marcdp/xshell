export default class ShortcutsSearchProvider {

    // ctor
    constructor({areas}) {
        // Retain effective global menus as the existing source of shortcuts.
        this.areas = areas;
    }

    // methods
    async query(text, {signal, limit}) {
        // Search every effective global menu without converting local self-embedded items into invalid results.
        const query = text.toLowerCase();
        const results = [];
        const menus = this.areas.getMenus().filter(menu => menu.scope === "global");
        for (const menu of menus) {
            signal?.throwIfAborted();
            this.collect(menu.items, menu, query, results, limit);
            if (results.length >= limit) break;
        }
        signal?.throwIfAborted();
        return results;
    }
    collect(items, menu, query, results, limit) {
        // Traverse navigable static shortcuts while preserving supported presentation modes.
        for (const item of items || []) {
            if (results.length >= limit) return;
            const searchable = [item.label, item.description, item.tooltip, item.path, item.href].filter(value => typeof value === "string").join(" ").toLowerCase();
            if (item.href && item.label !== "-" && item.open !== "embed" && searchable.includes(query)) {
                results.push({
                    id: `${menu.name}:${item.id || item.href}`,
                    label: item.label,
                    ...(item.description || item.tooltip ? {description: item.description || item.tooltip} : {}),
                    icon: item.icon || menu.icon || "x-link",
                    category: menu.label || menu.name,
                    href: item.href,
                    open: ["top", "stack", "dialog", "dock"].includes(item.open) ? item.open : "top"
                });
            }
            this.collect(item.children, menu, query, results, limit);
        }
    }
}
