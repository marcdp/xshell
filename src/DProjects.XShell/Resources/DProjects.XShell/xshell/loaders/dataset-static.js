export default class LoaderDatasetStatic {

    async load(url, context) {
        // static:a=1|b=2|c=3
        const definition = url.substring("static:".length);
        const columns = [
            { name: "key", type: "string" },
            { name: "value", type: "string" }
        ];
        const rows = definition.split("|").map(entry => {
            const index = entry.indexOf("=");
            if (index < 0) {
                throw new Error(`Invalid static dataset entry: '${entry}'`);
            }
            return {
                key: entry.substring(0, index),
                value: entry.substring(index + 1)
            };
        });
        return {
            tables: [
                { name: "items", columns, rows }
            ]
        };
    }
}