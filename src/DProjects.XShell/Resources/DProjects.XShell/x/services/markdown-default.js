import parse from "../utils/markdown.js";

export default class Markdown {

    // options
    static optionsSchema = {
        type: "object",
        properties: {
        },
        additionalProperties: false
    };


    // ctor
    constructor({}, options) {
    }

    // methods
    parse(markdown) {
        return parse(markdown); 
    }
}