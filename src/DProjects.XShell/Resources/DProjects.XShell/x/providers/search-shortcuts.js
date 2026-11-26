export default class ShortcutsSearchProvider {

    // ctor
    constructor({areas}) {
        // Retain effective global menus as the existing source of shortcuts.
        this.areas = areas;
    }

    // methods
    async query(text, {signal}) {
        // Search every effective global menu without converting local self-embedded items into invalid results.
        const query = text.toLowerCase();
        const results = [];
        const menus = this.areas.getMenus().filter(menu => menu.scope === "global");
        for (const menu of menus) {
            signal?.throwIfAborted();
            this.collect(menu.items, menu, query, results, signal);
        }
        signal?.throwIfAborted();
        return results;
    }
    collect(items, menu, query, results, signal, ancestors = []) {
        // Traverse navigable static shortcuts while preserving supported presentation modes.
        const occurrences = new Map();
        for (const item of items || []) {
            signal?.throwIfAborted();
            const segment = this.getIdentitySegment(item);
            const occurrence = occurrences.get(segment) || 0;
            occurrences.set(segment, occurrence + 1);
            const identity = [...ancestors, this.encodeIdentity([segment, occurrence])];
            const label = typeof item.label === "string" ? item.label.trim() : "";
            const href = typeof item.href === "string" ? item.href.trim() : "";
            const searchable = [item.label, item.description, item.tooltip, item.path, item.href].filter(value => typeof value === "string").join(" ").toLowerCase();
            if (href && label && label !== "-" && item.open !== "embed" && searchable.includes(query)) {
                results.push({
                    id: this.encodeIdentity(["menu", menu.name, ...identity]),
                    label,
                    ...(item.description || item.tooltip ? {description: item.description || item.tooltip} : {}),
                    icon: item.icon || menu.icon || "x-link",
                    category: menu.label || menu.name,
                    href,
                    open: ["top", "stack", "dialog", "dock"].includes(item.open) ? item.open : "top"
                });
            }
            this.collect(item.children, menu, query, results, signal, identity);
        }
    }
    getIdentitySegment(item) {
        // Prefer authored sibling identity, then stable navigation identity, and finally a structural branch fingerprint.
        const id = typeof item.id === "string" ? item.id.trim() : "";
        if (id) return this.encodeIdentity(["id", id]);
        const href = typeof item.href === "string" ? item.href.trim() : "";
        if (href) return this.encodeIdentity(["href", href]);
        const command = typeof item.command === "string" ? item.command.trim() : "";
        if (command) return this.encodeIdentity(["command", command]);
        const label = typeof item.label === "string" ? item.label.trim() : "";
        const descendants = this.getDescendantIdentities(item.children).sort();
        return this.encodeIdentity(["branch", String(item.module || ""), label, ...descendants]);
    }
    getDescendantIdentities(items) {
        // Describe a targetless branch with every available stable descendant identity field.
        return (items || []).flatMap(item => {
            const id = typeof item.id === "string" ? item.id.trim() : "";
            const href = typeof item.href === "string" ? item.href.trim() : "";
            const command = typeof item.command === "string" ? item.command.trim() : "";
            const module = typeof item.module === "string" ? item.module.trim() : "";
            const label = typeof item.label === "string" ? item.label.trim() : "";
            const own = this.encodeIdentity(["item", id, href, command, module, label]);
            return [own, ...this.getDescendantIdentities(item.children)];
        });
    }
    encodeIdentity(parts) {
        // Length-prefix every component so arbitrary IDs and destinations cannot create ambiguous concatenations.
        return parts.map(value => `${String(value).length}:${String(value)}`).join("");
    }
}
