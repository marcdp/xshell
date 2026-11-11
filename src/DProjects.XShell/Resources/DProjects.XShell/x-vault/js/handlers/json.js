import JSON5 from "../../vendor/json5.js";
import { encodeMetadata } from "../meta.js";
import HandlerBase from "./base.js";

export default class HandlerJson extends HandlerBase {
    entries(text) {
        // Python accepts JSON5 for both JSON and JSONC; scan validated source to retain exact formatting
        let data;
        try { data = JSON5.parse(text); } catch { throw new Error("Invalid xvault JSON/JSONC document."); }
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("XVault JSON requires a top-level object.");
        const lexemes = [...text.matchAll(/\s+|\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[^\s{}[\],:]+|[{}[\],:]/g)]
            .filter(match => !/^\s|^\/\//.test(match[0]) && !match[0].startsWith("/*"));
        const entries = [];
        let index = 1;
        let start = lexemes[0].index + 1;
        while (index < lexemes.length && lexemes[index][0] !== "}") {
            const keyToken = lexemes[index++];
            const key = JSON5.parse("{" + keyToken[0] + ":null}");
            index++; // colon
            const valueStart = lexemes[index].index;
            let depth = 0;
            while (index < lexemes.length) {
                const value = lexemes[index][0];
                if (depth === 0 && (value === "," || value === "}")) break;
                if (value === "{" || value === "[") depth++;
                if (value === "}" || value === "]") depth--;
                index++;
            }
            const delimiter = lexemes[index];
            const valueEnd = lexemes[index - 1].index + lexemes[index - 1][0].length;
            entries.push({ key: Object.keys(key)[0], start, keyStart: keyToken.index, valueStart, valueEnd,
                end: delimiter.index, comma: delimiter[0] === "," ? delimiter.index : null });
            if (delimiter[0] !== ",") break;
            start = delimiter.index + 1;
            index++;
        }
        return { entries, data, open: lexemes[0].index + 1, close: lexemes.at(-1).index };
    }

    parse(text) {
        const document = this.entries(text);
        const matches = document.entries.flatMap((entry, index) => {
            if (entry.key !== "_xvault") return [];
            const previous = document.entries[index - 1];
            const next = document.entries[index + 1];
            return [{ start: entry.keyStart, end: entry.valueEnd, value: document.data._xvault,
                property: text.slice(entry.keyStart, entry.valueEnd), next: next?.key, previous: previous?.key,
                position: index, comma: entry.comma ?? previous?.comma }];
        });
        const parsed = this.extract(text, matches);
        if (parsed.slot?.comma !== undefined && parsed.slot.comma !== null) {
            const { start, end, comma } = parsed.slot;
            const at = comma < start ? comma : comma - (end - start);
            parsed.text = parsed.text.slice(0, at) + parsed.text.slice(at + 1);
        }
        return parsed;
    }

    restore(text, parsed) {
        const document = this.entries(text);
        const entries = document.entries;
        const slot = parsed.slot;
        if (!slot) {
            const newline = text.includes("\r\n") ? "\r\n" : "\n";
            const indent = text.match(/\r?\n([ \t]+)\S/)?.[1] || "  ";
            const property = newline + indent + '"_xvault": ' + JSON.stringify(encodeMetadata(parsed.metadata));
            return text.slice(0, document.open) + property + (entries.length ? "," : "") + text.slice(document.open);
        }
        // restore the original property spelling and prefer its original neighboring property
        let index = entries.findIndex(entry => entry.key === slot.next);
        if (index < 0) {
            const previous = entries.findIndex(entry => entry.key === slot.previous);
            index = previous < 0 ? Math.min(slot.position, entries.length) : previous + 1;
        }
        if (!entries.length) return text.slice(0, document.open) + slot.property + text.slice(document.open);
        if (index < entries.length) {
            const at = entries[index].start;
            return text.slice(0, at) + slot.property + "," + text.slice(at);
        }
        const last = entries.at(-1);
        const at = last.comma ?? last.end;
        return text.slice(0, at) + "," + slot.property + text.slice(at);
    }
}
