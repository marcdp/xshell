import { decodeMetadata, encodeMetadata } from "../meta.js";

export default class HandlerBase {
    pattern = /(?<!\$\{)enc:[^"\r\n]+/g;

    tokens(text) {
        // protect wrapped occurrences before applying Python's format-specific unwrapped delimiters
        const tokens = [...text.matchAll(/\$\{enc:[^}\r\n]+\}+/g)].map(match => ({
            start: match.index, end: match.index + match[0].length, value: match[0].slice(6, -1), wrapped: true
        }));
        for (const match of text.matchAll(this.pattern)) {
            const start = match.index;
            const end = start + match[0].length;
            if (tokens.some(token => start >= token.start && start < token.end)) continue;
            if (tokens.some(token => start < token.end && end > token.start)) throw new Error("Ambiguous overlapping xvault markers.");
            tokens.push({ start, end, value: match[0].slice(4), wrapped: false });
        }
        tokens.sort((a, b) => a.start - b.start);
        return tokens;
    }

    replace(text, tokens, values) {
        let result = "";
        let end = 0;
        tokens.forEach((token, index) => {
            result += text.slice(end, token.start) + values[index];
            end = token.end;
        });
        return result + text.slice(end);
    }

    marker(token, value) {
        return token.wrapped ? "${enc:" + value + "}" : "enc:" + value;
    }

    describe(text) {
        const tokens = this.tokens(text);
        const pieces = [];
        let end = 0;
        for (const token of tokens) {
            pieces.push(text.slice(end, token.start));
            end = token.end;
            const lineStart = text.lastIndexOf("\n", token.start - 1) + 1;
            const nextLine = text.indexOf("\n", token.end);
            const lineEnd = nextLine < 0 ? text.length : nextLine;
            const lineTokens = tokens.filter(item => item.start >= lineStart && item.end <= lineEnd);
            const line = text.slice(lineStart, lineEnd).replace(/\r$/, "");
            const local = lineTokens.map(item => ({ ...item, start: item.start - lineStart, end: item.end - lineStart }));
            token.context = JSON.stringify([this.replace(line, local, local.map(() => "<xvault-token>")), lineTokens.indexOf(token)]);
        }
        pieces.push(text.slice(end));
        // arrays avoid collisions between literal document content and an internal placeholder
        return { text, tokens, skeleton: JSON.stringify(pieces) };
    }

    extract(text, matches) {
        if (matches.length > 1) throw new Error("Duplicate _xvault metadata entries.");
        if (!matches.length) return { text, metadata: null, slot: null };
        const slot = matches[0];
        const metadata = decodeMetadata(slot.value);
        return { text: text.slice(0, slot.start) + text.slice(slot.end), metadata, slot: { ...slot, raw: text.slice(slot.start, slot.end) } };
    }

    parseLines(text, pattern) {
        const matches = [...text.matchAll(pattern)].map(match => ({
            start: match.index, end: match.index + match[0].length, value: match[1].trim()
        }));
        const result = this.extract(text, matches);
        if (result.slot) {
            result.slot.line = text.slice(0, result.slot.start).split("\n").length - 1;
            result.slot.before = text.slice(0, result.slot.start).split(/\r?\n/).at(-2);
            result.slot.after = text.slice(result.slot.end).split(/\r?\n/)[0];
        }
        return result;
    }

    restoreLine(text, parsed, prefix) {
        const newline = text.includes("\r\n") ? "\r\n" : "\n";
        if (!parsed?.slot) return prefix + encodeMetadata(parsed.metadata) + newline + text;
        const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
        const normalized = line => this.describe(line.replace(/\r?\n$/, "")).skeleton;
        let index = Math.min(parsed.slot.line, lines.length);
        for (const [anchor, offset] of [[parsed.slot.after, 0], [parsed.slot.before, 1]]) {
            if (!anchor) continue;
            const candidates = lines.flatMap((line, i) => normalized(line) === normalized(anchor) ? [i + offset] : []);
            if (candidates.length === 1) {
                index = candidates[0];
                break;
            }
        }
        const before = lines.slice(0, index).join("");
        const after = lines.slice(index).join("");
        return before + (before && !before.endsWith("\n") ? newline : "") + parsed.slot.raw +
            (after && !parsed.slot.raw.endsWith("\n") ? newline : "") + after;
    }
}
