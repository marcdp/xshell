import HandlerBase from "./base.js";

export default class HandlerEnv extends HandlerBase {
    pattern = /(?<!\$\{)enc:[^\r\n#"']+/g;

    parse(text) {
        // Parse `_xvault` metadata from an environment-file assignment.
        return this.parseLines(text, /^[ \t]*_xvault[ \t]*=[ \t]*([^\r\n]*)(?:\r?\n|$)/gm);
    }

    restore(text, parsed) {
        // Restore environment-file metadata using the standard assignment prefix.
        return this.restoreLine(text, parsed, "_xvault=");
    }
}
