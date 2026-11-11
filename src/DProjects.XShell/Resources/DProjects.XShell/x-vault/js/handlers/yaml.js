import { parseDocument, isMap, isScalar } from "../../vendor/yaml.js";
import { encodeMetadata } from "../meta.js";
import HandlerBase from "./base.js";

export default class HandlerYaml extends HandlerBase {
    document(text) {
        const document = parseDocument(text, { keepSourceTokens: true, uniqueKeys: false, version: "1.1" });
        if (document.errors.length) throw new Error("Invalid xvault YAML document.");
        if (document.contents !== null && !isMap(document.contents)) throw new Error("XVault YAML requires a top-level mapping.");
        return document.contents;
    }

    parse(text) {
        const root = this.document(text);
        const items = root?.items || [];
        const matches = items.flatMap((pair, index) => {
            if (!isScalar(pair.key) || pair.key.value !== "_xvault") return [];
            if (!isScalar(pair.value) || typeof pair.value.value !== "string" || pair.value.anchor) {
                throw new Error("Invalid _xvault YAML metadata scalar.");
            }
            let start = pair.key.range[0];
            let end = pair.value.range[2];
            const property = text.slice(start, end);
            if (root.flow) {
                const comma = items[index + 1]?.srcToken.start.find(token => token.type === "comma");
                if (comma) end = comma.offset + 1;
                else start = pair.srcToken.start.find(token => token.type === "comma")?.offset ?? start;
            } else {
                start = text.lastIndexOf("\n", start - 1) + 1;
            }
            return [{ start, end, value: pair.value.value, property, position: index, flow: !!root.flow,
                next: items[index + 1]?.key.value, previous: items[index - 1]?.key.value }];
        });
        return this.extract(text, matches);
    }

    restore(text, parsed) {
        const root = this.document(text);
        const items = root?.items || [];
        const slot = parsed.slot;
        const newline = text.includes("\r\n") ? "\r\n" : "\n";
        if (slot && slot.flow !== !!root?.flow && items.length) throw new Error("Changing the YAML metadata container is not supported.");
        let index = slot ? items.findIndex(pair => pair.key.value === slot.next) : 0;
        if (index < 0) {
            const previous = items.findIndex(pair => pair.key.value === slot.previous);
            index = previous < 0 ? Math.min(slot.position, items.length) : previous + 1;
        }
        const property = slot?.property ?? "_xvault: " + encodeMetadata(parsed.metadata);
        if (root?.flow) {
            const at = index < items.length ? items[index].key.range[0] : root.range[1] - 1;
            const raw = property + (index < items.length ? ", " : "");
            return text.slice(0, at) + (index === items.length && items.length ? ", " : "") + raw + text.slice(at);
        }
        // insert only at mapping boundaries, never in a nested value or after a document-end directive
        const at = index < items.length ? text.lastIndexOf("\n", items[index].key.range[0] - 1) + 1 : root?.range[1] ?? text.length;
        const before = text.slice(0, at);
        const raw = slot?.raw ?? property + newline;
        return before + (before && !before.endsWith("\n") ? newline : "") + raw +
            (!raw.endsWith("\n") && text.slice(at) ? newline : "") + text.slice(at);
    }
}
