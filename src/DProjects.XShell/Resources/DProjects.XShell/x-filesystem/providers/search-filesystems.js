export default class FilesystemsSearchProvider {

    // ctor
    constructor({filesystems}) {
        // Retain only the Filesystems discovery Service; queries never open an instance or credentials.
        this.filesystems = filesystems;
    }

    // methods
    async query(text, {signal, limit}) {
        // Search non-secret named definition metadata and preserve the named registration identity in navigation.
        signal?.throwIfAborted();
        const definitions = await this.filesystems.listDefinitions();
        signal?.throwIfAborted();
        const query = text.toLowerCase();
        const results = [];
        for (const item of definitions) {
            signal?.throwIfAborted();
            if (![item.name, item.label, item.description].some(value => String(value || "").toLowerCase().includes(query))) continue;
            results.push({
                id: item.name,
                label: item.label || item.name,
                ...(item.description ? {description: item.description} : {}),
                icon: "x-filesystem",
                category: "Filesystems",
                href: `page:x-filesystem:/pages/explorer.js?src=${encodeURIComponent(`named:${item.name}`)}&path=%2F`,
                open: "top"
            });
            if (results.length === limit) break;
        }
        return results;
    }
}
