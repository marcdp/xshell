import parse from "../utils/markdown.js";

export default class Markdown {

    // ctor
    constructor() {
    }

    // methods
    parse(markdown) {
        return parse(markdown); 
    }
}