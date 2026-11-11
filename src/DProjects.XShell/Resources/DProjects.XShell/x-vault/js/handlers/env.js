import HandlerBase from "./base.js";

export default class HandlerEnv extends HandlerBase {
    pattern = /(?<!\$\{)enc:[^\r\n#"']+/g;

    parse(text) {
        return this.parseLines(text, /^[ \t]*_xvault[ \t]*=[ \t]*([^\r\n]*)(?:\r?\n|$)/gm);
    }

    restore(text, parsed) {
        return this.restoreLine(text, parsed, "_xvault=");
    }
}
