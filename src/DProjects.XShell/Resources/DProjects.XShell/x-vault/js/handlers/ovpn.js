import HandlerBase from "./base.js";

export default class HandlerOvpn extends HandlerBase {
    pattern = /^enc:[^\r\n]+/gm;

    parse(text) {
        // Parse `_xvault` metadata from an OpenVPN comment.
        return this.parseLines(text, /^#[ \t]*_xvault[ \t]*=[ \t]*([^\r\n]*)(?:\r?\n|$)/gm);
    }

    restore(text, parsed) {
        // Restore OpenVPN metadata using the standard comment prefix.
        return this.restoreLine(text, parsed, "# _xvault=");
    }
}
