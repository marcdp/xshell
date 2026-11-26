export default class QueriesSearchProvider {

    // ctor
    constructor({queries}) {
        // Use the Queries service as the source of discovery metadata.
        this.queries = queries;
    }

    // methods
    async query(text, {signal}) {
        // Match inventory entries and link each result to the shared invocation Page.
        signal?.throwIfAborted();
        const items = this.queries.list({query: text});
        signal?.throwIfAborted();
        return items.map(item => ({
            id: item.id,
            type: "query",
            label: item.label || item.id,
            ...(item.description ? {description: item.description} : {}),
            icon: item.icon || "x-search",
            category: item.category || "Queries",
            tags: [...(item.tags || [])],
            href: `page:x:/pages/invoke.js?type=query&id=${encodeURIComponent(item.id)}&method=query`,
            open: "stack"
        }));
    }
}
