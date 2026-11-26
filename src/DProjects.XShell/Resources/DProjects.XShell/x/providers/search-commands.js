export default class CommandsSearchProvider {

    // ctor
    constructor({commands}) {
        // Retain the Commands discovery Service without loading or executing Command implementations.
        this.commands = commands;
    }

    // methods
    async query(text, {signal}) {
        // Reuse the metadata inventory and direct activation to the existing invocation interface.
        signal?.throwIfAborted();
        const items = this.commands.list({query: text});
        signal?.throwIfAborted();
        return items.map(item => ({
            id: item.id,
            label: item.label || item.id,
            ...(item.description ? {description: item.description} : {}),
            icon: item.icon || "x-command",
            category: item.category || "Commands",
            tags: [...(item.tags || [])],
            href: `page:x:/pages/invoke.js?type=command&id=${encodeURIComponent(item.id)}`,
            open: "stack"
        }));
    }
}
