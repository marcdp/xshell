import products from "../data/query-products.js";

export default {
    contract: {
        label: "List product names",
        description: "Lists product names in a category, or across all categories.",
        tags: ["demo", "inventory"],
        query: {
            parameters: [{name: "category", type: "string", enum: ["stationery", "accessories"]}],
            returns: {type: "array", schema: {items: {type: "string"}}}
        }
    },

    controller() {
        return {
            query(category) {
                // Map the optional category selection to an array of names.
                return products.filter(product => category === undefined || product.category === category).map(product => product.name);
            }
        };
    }
};
