import products from "../data/query-products.js";

export default {
    contract: {
        label: "Count products",
        description: "Counts products that meet a minimum stock level.",
        tags: ["demo", "inventory"],
        query: {
            parameters: [{name: "minimumStock", type: "integer", default: 1, schema: {minimum: 0}}],
            returns: {type: "integer", schema: {minimum: 0}}
        }
    },

    controller() {
        return {
            query(minimumStock) {
                // Count matching records without changing the sample inventory.
                return products.filter(product => product.stock >= minimumStock).length;
            }
        };
    }
};
