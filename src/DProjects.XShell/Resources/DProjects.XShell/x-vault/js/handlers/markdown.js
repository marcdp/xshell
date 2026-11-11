import HandlerBase from "./base.js";
import HandlerYaml from "./yaml.js";

export default class HandlerMarkdown extends HandlerBase {
    frontMatter(text) {
        const match = /^---\r?\n([\s\S]*?)^---(?=\r?\n|$)/m.exec(text);
        if (!match || match.index !== 0) return null;
        const start = text.indexOf("\n") + 1;
        return { start, end: match[0].length - 3, text: match[1] };
    }

    parse(text) {
        const front = this.frontMatter(text);
        if (!front) return { text, metadata: null, slot: null };
        const parsed = new HandlerYaml().parse(front.text);
        return { text: text.slice(0, front.start) + parsed.text + text.slice(front.end), metadata: parsed.metadata,
            slot: parsed.slot, front: true };
    }

    restore(text, parsed) {
        const handler = new HandlerYaml();
        const front = this.frontMatter(text);
        if (!front) {
            if (parsed.front) throw new Error("The original Markdown front matter must be retained.");
            const newline = text.includes("\r\n") ? "\r\n" : "\n";
            const metadata = handler.restore("", parsed).replace(/\r?\n/g, newline);
            return "---" + newline + metadata + "---" + newline + newline + text;
        }
        return text.slice(0, front.start) + handler.restore(front.text, parsed) + text.slice(front.end);
    }
}
