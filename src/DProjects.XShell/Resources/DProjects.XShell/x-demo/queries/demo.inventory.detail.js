import products from "../data/query-products.js";

export default {
    contract: {
        label: "Find a product",
        description: "Looks up a product by SKU.",
        tags: ["demo", "inventory"],
        types: {
            productLookup: {
                type: "any",
                schema: {
                    anyOf: [
                        {
                            type: "object",
                            properties: {sku: {type: "string"}, name: {type: "string"}, category: {type: "string"}, stock: {type: "integer"}},
                            required: ["sku", "name", "category", "stock"],
                            additionalProperties: false
                        },
                        {type: "null"}
                    ]
                }
            }
        },
        query: {
            parameters: [{name: "sku", type: "string", required: true, schema: {minLength: 1}}],
            returns: {ref: "productLookup"}
        }
    },

    controller() {
        return {
            query(sku) {
                // Return an independent product record when the SKU exists.
                const product = products.find(item => item.sku === sku);
                return product ? {...product} : null;
            }
        };
    }
};
