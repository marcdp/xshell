export default class StoresSearchProvider {

    // ctor
    constructor({stores}, {sources = []} = {}) {
        // Retain the Store URLs selected for collection discovery.
        this.stores = stores;
        this.sources = sources;
    }

    // methods
    async query(text, {signal}) {
        // Search collection metadata without reading Store documents.
        const query = text.toLowerCase();
        const results = [];
        for (const src of this.sources) {
            signal?.throwIfAborted();
            const store = await this.stores.open(src);
            signal?.throwIfAborted();
            for (const [name, {label, description}] of Object.entries(store.schema.collections)) {
                if (![name, label, description].some(value => value?.toLowerCase().includes(query))) continue;
                const source = encodeURIComponent(src);
                const collection = encodeURIComponent(name);
                results.push({
                    id: `${source}:${collection}`,
                    label,
                    ...(description ? {description} : {}),
                    icon: "x-database",
                    category: store.schema.label,
                    href: `page:x-store:/pages/store.js?src=${source}&collection=${collection}`,
                    open: "stack"
                });
            }
        }
        return results;
    }
}
