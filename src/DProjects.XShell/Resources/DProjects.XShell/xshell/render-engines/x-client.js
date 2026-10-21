import createRenderEngineFactoryX, { XTemplateRuntimeUtils } from "./x.js";

// constants / grammar

const TOKEN_END = "end";
const PROTECTED_MEMBERS = new Set(["__proto__", "prototype", "constructor"]);
const CONDITIONAL_DIRECTIVES = new Set(["if", "elseif", "else"]);
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const PRIMARY_STRUCTURAL_DIRECTIVES = new Set(["x-if", "x-elseif", "x-else", "x-for", "x-recursive", "x-once"]);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function expressionError(message, source, offset) {
    const context = source.length > 80 ? source.slice(0, 77) + "..." : source;
    return new Error(`XTemplate expression error at offset ${offset}: ${message} in '${context}'.`);
}

function templateError(message, node = null) {
    const context = node?.localName ? ` Near <${node.localName}>.` : "";
    return new Error(`XTemplate client parse error: ${message}${context}`);
}

function runtimeError(message) {
    return new Error(`XTemplate runtime error: ${message}`);
}

function isIdentifierStart(character) {
    return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character) {
    return character !== undefined && /[A-Za-z0-9_]/.test(character);
}

function isValidAttributeName(name) {
    if (!name) return false;
    for (const character of name) {
        const value = character.codePointAt(0);
        if (/\s/u.test(character) || `"'<>\u003d/\0`.includes(character) || value <= 0x1f || value === 0x7f || value >= 0xfdd0 && value <= 0xfdef || (value & 0xffff) === 0xfffe || (value & 0xffff) === 0xffff) return false;
    }
    return true;
}

function isValidStyleName(name) {
    if (!name || [...name].some(character => /\s|\p{Cc}/u.test(character) || character === ":" || character === ";")) return false;
    if (name.startsWith("--")) return name.length > 2;
    const characters = [...name];
    return /^[\p{L}_-]$/u.test(characters[0]) && characters.slice(1).every(character => /^[\p{L}\p{Nd}_-]$/u.test(character));
}

function normalizeStyleName(name) {
    return name.startsWith("--") ? name : name.toLowerCase();
}

function kebabToCamel(value) {
    let result = "";
    let upper = false;
    for (const character of value) {
        if (character === "-") upper = true;
        else {
            result += upper ? character.toUpperCase() : character;
            upper = false;
        }
    }
    return result;
}

function freeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

// expression tokenizer

export function tokenizeExpression(source) {
    if (typeof source !== "string") throw new TypeError("XTemplate expression source must be a string.");
    const tokens = [];
    let position = 0;
    const push = (kind, text, value, offset) => tokens.push({ kind, text, value, offset });
    const match = character => {
        if (source[position] !== character) return false;
        position++;
        return true;
    };

    while (position < source.length) {
        while (position < source.length && /[ \t\r\n]/.test(source[position])) position++;
        if (position >= source.length) break;
        const offset = position;
        const character = source[position++];

        if (isIdentifierStart(character)) {
            while (isIdentifierPart(source[position])) position++;
            const text = source.slice(offset, position);
            if (text === "null") push("literal", text, null, offset);
            else if (text === "true") push("literal", text, true, offset);
            else if (text === "false") push("literal", text, false, offset);
            else push("identifier", text, null, offset);
            continue;
        }

        if (character >= "0" && character <= "9") {
            while (source[position] >= "0" && source[position] <= "9") position++;
            if (source[position] === ".") {
                const decimalOffset = position++;
                if (!(source[position] >= "0" && source[position] <= "9")) throw expressionError("A decimal point must be followed by digits", source, decimalOffset);
                while (source[position] >= "0" && source[position] <= "9") position++;
            }
            const text = source.slice(offset, position);
            const value = Number(text);
            if (!Number.isFinite(value)) throw expressionError("Numeric literals must be finite binary64 values", source, offset);
            push("literal", text, value, offset);
            continue;
        }

        if (character === "'" || character === '"') {
            let value = "";
            let closed = false;
            while (position < source.length) {
                let item = source[position++];
                if (item === character) { closed = true; break; }
                if (item === "\r" || item === "\n") throw expressionError("A string cannot contain a raw line break", source, position - 1);
                if (item !== "\\") {
                    const code = item.charCodeAt(0);
                    if (code >= 0xdc00 && code <= 0xdfff) throw expressionError("String literals must not contain unpaired surrogates", source, position - 1);
                    if (code >= 0xd800 && code <= 0xdbff) {
                        const low = source[position];
                        const lowCode = low?.charCodeAt(0);
                        if (!(lowCode >= 0xdc00 && lowCode <= 0xdfff)) throw expressionError("String literals must not contain unpaired surrogates", source, position - 1);
                        value += item + low;
                        position++;
                    } else value += item;
                    continue;
                }
                if (position >= source.length) throw expressionError("Incomplete string escape", source, position - 1);
                item = source[position++];
                if (item === "u") {
                    const unicodeOffset = position - 2;
                    const text = source.slice(position, position + 4);
                    if (!/^[0-9A-Fa-f]{4}$/.test(text)) throw expressionError("Malformed Unicode escape", source, unicodeOffset);
                    position += 4;
                    const code = Number.parseInt(text, 16);
                    if (code >= 0xdc00 && code <= 0xdfff) throw expressionError("Unicode escapes must not contain unpaired surrogates", source, unicodeOffset);
                    if (code >= 0xd800 && code <= 0xdbff) {
                        const lowText = source.slice(position, position + 6);
                        if (!/^\\u[0-9A-Fa-f]{4}$/.test(lowText)) throw expressionError("Unicode escapes must not contain unpaired surrogates", source, unicodeOffset);
                        const low = Number.parseInt(lowText.slice(2), 16);
                        if (!(low >= 0xdc00 && low <= 0xdfff)) throw expressionError("Unicode escapes must not contain unpaired surrogates", source, unicodeOffset);
                        position += 6;
                        value += String.fromCharCode(code, low);
                    } else value += String.fromCharCode(code);
                    continue;
                }
                const escaped = { "\\": "\\", "'": "'", '"': '"', n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[item];
                if (escaped === undefined) throw expressionError(`Unknown escape '\\${item}'`, source, position - 1);
                value += escaped;
            }
            if (!closed) throw expressionError("Unterminated string", source, offset);
            push("literal", source.slice(offset, position), value, offset);
            continue;
        }

        let kind = character;
        let text = character;
        if (character === "|" && match("|")) { kind = "||"; text = "||"; }
        else if (character === "?" && match("?")) { kind = "??"; text = "??"; }
        else if (character === "!" && match("=")) { kind = "!="; text = "!="; }
        else if (character === "<" && match("=")) { kind = "<="; text = "<="; }
        else if (character === ">" && match("=")) { kind = ">="; text = ">="; }
        else if (character === "=" && match("=")) { kind = "=="; text = "=="; }
        else if (character === "&" && match("&")) { kind = "&&"; text = "&&"; }
        else if (character === "+" && match("+")) throw expressionError("Update operator '++' is not valid in XTemplate expressions", source, offset);
        else if (character === "-" && match("-")) throw expressionError("Update operator '--' is not valid in XTemplate expressions", source, offset);
        else if (character === "=") throw expressionError("Assignment operator '=' is not valid in XTemplate expressions", source, offset);
        else if (character === "&") throw expressionError("Unexpected '&'", source, offset);
        else if (!".[]()?,|:+-*/%!<>".includes(character)) throw expressionError(`Unexpected character '${character}'`, source, offset);
        push(kind, text, null, offset);
    }
    push(TOKEN_END, "", null, source.length);
    return tokens;
}

// expression parser

class ExpressionParser {
    constructor(source, allowedIdentifiers = null) {
        this.source = source;
        this.tokens = tokenizeExpression(source);
        this.position = 0;
        this.allowedIdentifiers = allowedIdentifiers == null ? null : new Set(allowedIdentifiers);
    }

    get current() { return this.tokens[this.position]; }
    next() { return this.tokens[this.position++]; }
    take(kind) { if (this.current.kind !== kind) return false; this.position++; return true; }
    require(kind, message) { if (!this.take(kind)) throw expressionError(message, this.source, this.current.offset); }

    parse() {
        if (this.current.kind === TOKEN_END) throw expressionError("Expected an expression", this.source, this.current.offset);
        const expression = this.parsePipeline();
        if (this.current.kind !== TOKEN_END) throw expressionError(`Unexpected token '${this.current.text}'`, this.source, this.current.offset);
        return freeze(expression);
    }

    parsePipeline() {
        let expression = this.parseConditional();
        if (!this.take("|")) return expression;
        const transformers = [];
        do {
            const name = this.current;
            this.require("identifier", "Expected a transformer identifier after '|'");
            const args = [];
            if (this.take("(") && !this.take(")")) {
                do args.push(this.parsePipeline()); while (this.take(","));
                this.require(")", "Missing closing ')' in transformer arguments");
            }
            transformers.push({ name: name.text, args, offset: name.offset });
        } while (this.take("|"));
        return { type: "transform", source: expression, transformers, offset: transformers[0].offset };
    }

    parseConditional() {
        const condition = this.parseCoalesce();
        if (!this.take("?")) return condition;
        const offset = this.tokens[this.position - 1].offset;
        const whenTrue = this.parseConditional();
        this.require(":", "Expected ':' in conditional expression");
        return { type: "conditional", condition, whenTrue, whenFalse: this.parseConditional(), offset };
    }

    parseCoalesce() { return this.parseBinary(() => this.parseLogicalOr(), ["??"]); }
    parseLogicalOr() { return this.parseBinary(() => this.parseLogicalAnd(), ["||"]); }
    parseLogicalAnd() { return this.parseBinary(() => this.parseEquality(), ["&&"]); }
    parseEquality() { return this.parseBinary(() => this.parseComparison(), ["==", "!="]); }
    parseComparison() { return this.parseBinary(() => this.parseAdditive(), ["<", "<=", ">", ">="]); }
    parseAdditive() { return this.parseBinary(() => this.parseMultiplicative(), ["+", "-"]); }
    parseMultiplicative() { return this.parseBinary(() => this.parseUnary(), ["*", "/", "%"]); }

    parseBinary(parseOperand, operators) {
        let expression = parseOperand();
        while (operators.includes(this.current.kind)) {
            const operator = this.next();
            expression = { type: "binary", operator: operator.kind, left: expression, right: parseOperand(), offset: operator.offset };
        }
        return expression;
    }

    parseUnary() {
        if (["!", "+", "-"].includes(this.current.kind)) {
            const operator = this.next();
            return { type: "unary", operator: operator.kind, operand: this.parseUnary(), offset: operator.offset };
        }
        return this.parseMember();
    }

    parseMember() {
        let expression = this.parsePrimary();
        while (true) {
            if (this.take(".")) {
                const member = this.current;
                this.require("identifier", "Expected a member identifier after '.'");
                if (PROTECTED_MEMBERS.has(member.text)) throw expressionError(`Protected member '${member.text}' cannot be accessed`, this.source, member.offset);
                expression = { type: "member", target: expression, name: member.text, offset: member.offset };
            } else if (this.take("[")) {
                const offset = this.tokens[this.position - 1].offset;
                const index = this.parsePipeline();
                this.require("]", "Missing closing ']'");
                expression = { type: "index", target: expression, index, offset };
            } else return expression;
        }
    }

    parsePrimary() {
        const token = this.next();
        if (token.kind === "literal") return { type: "literal", value: token.value, offset: token.offset };
        if (token.kind === "identifier") {
            if (this.allowedIdentifiers && !this.allowedIdentifiers.has(token.text)) throw expressionError(`Unknown XTemplate identifier '${token.text}'`, this.source, token.offset);
            return { type: "identifier", name: token.text, offset: token.offset };
        }
        if (token.kind === "(") {
            const expression = this.parsePipeline();
            this.require(")", "Missing closing ')'");
            return expression;
        }
        throw expressionError(`Expected an expression, found '${token.text}'`, this.source, token.offset);
    }
}

export function parseExpression(source, allowedIdentifiers = null) {
    return new ExpressionParser(source, allowedIdentifiers).parse();
}

// expression evaluator / assignment

function readIdentifier(scope, name) {
    if (!Object.prototype.hasOwnProperty.call(scope, name)) throw runtimeError(`Unknown XTemplate identifier '${name}'`);
    return scope[name];
}

function checkIndex(index) {
    if (typeof index === "string" && PROTECTED_MEMBERS.has(index)) throw runtimeError(`Protected member '${index}' cannot be accessed`);
    return index;
}

export function evaluateExpression(node, scope, runtimeUtils = XTemplateRuntimeUtils, i18n = null) {
    const expr = runtimeUtils.expr;
    switch (node.type) {
        case "literal": return node.value;
        case "identifier": return readIdentifier(scope, node.name);
        case "member": return expr.member(evaluateExpression(node.target, scope, runtimeUtils, i18n), node.name);
        case "index": return expr.index(evaluateExpression(node.target, scope, runtimeUtils, i18n), checkIndex(evaluateExpression(node.index, scope, runtimeUtils, i18n)));
        case "unary": {
            const value = evaluateExpression(node.operand, scope, runtimeUtils, i18n);
            return node.operator === "!" ? expr.not(value) : node.operator === "+" ? expr.unaryPlus(value) : expr.unaryMinus(value);
        }
        case "binary": {
            if (node.operator === "&&") return expr.and(() => evaluateExpression(node.left, scope, runtimeUtils, i18n), () => evaluateExpression(node.right, scope, runtimeUtils, i18n));
            if (node.operator === "||") return expr.or(() => evaluateExpression(node.left, scope, runtimeUtils, i18n), () => evaluateExpression(node.right, scope, runtimeUtils, i18n));
            if (node.operator === "??") return expr.coalesce(() => evaluateExpression(node.left, scope, runtimeUtils, i18n), () => evaluateExpression(node.right, scope, runtimeUtils, i18n));
            const left = evaluateExpression(node.left, scope, runtimeUtils, i18n);
            const right = evaluateExpression(node.right, scope, runtimeUtils, i18n);
            const method = { "+": "add", "-": "subtract", "*": "multiply", "/": "divide", "%": "modulo", "==": "equal", "!=": "notEqual", "<": "less", "<=": "lessOrEqual", ">": "greater", ">=": "greaterOrEqual" }[node.operator];
            return expr[method](left, right);
        }
        case "conditional": return expr.conditional(
            () => evaluateExpression(node.condition, scope, runtimeUtils, i18n),
            () => evaluateExpression(node.whenTrue, scope, runtimeUtils, i18n),
            () => evaluateExpression(node.whenFalse, scope, runtimeUtils, i18n));
        case "transform": {
            let value = evaluateExpression(node.source, scope, runtimeUtils, i18n);
            for (const transformer of node.transformers) {
                value = expr.transform(value, transformer.name, () => transformer.args.map(argument => evaluateExpression(argument, scope, runtimeUtils, i18n)), i18n);
            }
            return value;
        }
        default: throw runtimeError(`Unsupported expression node '${node.type}'`);
    }
}

function assignmentPath(node) {
    const segments = [];
    while (node.type === "member" || node.type === "index") {
        segments.push(node);
        node = node.target;
    }
    segments.reverse();
    if (node.type !== "identifier" || segments.length === 0) return null;
    return { root: node, segments };
}

export function assignExpression(node, scope, value, runtimeUtils = XTemplateRuntimeUtils, i18n = null) {
    const path = assignmentPath(node);
    if (!path) throw runtimeError("Model assignment error: requires an assignable member or index expression");
    return runtimeUtils.expr.assign(readIdentifier(scope, path.root.name), path.segments.map(segment => segment.type === "member"
        ? { kind: "member", name: segment.name }
        : { kind: "index", value: () => checkIndex(evaluateExpression(segment.index, scope, runtimeUtils, i18n)) }), value);
}

// literal style parser

function parseStyleDeclarations(source) {
    const declarations = new Map();
    let position = 0;
    while (position < source.length) {
        while (position < source.length && (/\s/.test(source[position]) || source[position] === ";")) position++;
        if (position >= source.length) break;
        const start = position;
        let colon = -1;
        let quote = null;
        let parentheses = 0;
        let brackets = 0;
        let braces = 0;
        while (position < source.length) {
            const character = source[position];
            if (character === "\\") {
                if (position + 1 >= source.length) throw templateError("Invalid style declaration: incomplete escape");
                position += 2;
                continue;
            }
            if (quote) { if (character === quote) quote = null; position++; continue; }
            if (character === "'" || character === '"') { quote = character; position++; continue; }
            if (character === "(") parentheses++;
            else if (character === ")" && --parentheses < 0) throw templateError("Invalid style declaration: unmatched ')'");
            else if (character === "[") brackets++;
            else if (character === "]" && --brackets < 0) throw templateError("Invalid style declaration: unmatched ']'");
            else if (character === "{") braces++;
            else if (character === "}" && --braces < 0) throw templateError("Invalid style declaration: unmatched '}'");
            else if (character === ":" && colon < 0 && parentheses === 0 && brackets === 0 && braces === 0) colon = position;
            else if (character === ";" && parentheses === 0 && brackets === 0 && braces === 0) break;
            position++;
        }
        if (quote || parentheses || brackets || braces) throw templateError("Invalid style declaration: unclosed string or function");
        const end = position;
        if (source[position] === ";") position++;
        if (colon < start || colon >= end) throw templateError("Invalid style declaration: expected a property name followed by ':'");
        let name = source.slice(start, colon).trim();
        let value = source.slice(colon + 1, end).trim();
        if (!isValidStyleName(name)) throw templateError(`Invalid style declaration property name '${name}'`);
        if (!value) throw templateError(`Invalid style declaration for '${name}': value is empty`);
        name = normalizeStyleName(name);

        quote = null; parentheses = 0; brackets = 0; braces = 0;
        let important = -1;
        for (let index = 0; index < value.length; index++) {
            const character = value[index];
            if (character === "\\") { index++; continue; }
            if (quote) { if (character === quote) quote = null; continue; }
            if (character === "'" || character === '"') quote = character;
            else if (character === "(") parentheses++;
            else if (character === ")") parentheses--;
            else if (character === "[") brackets++;
            else if (character === "]") brackets--;
            else if (character === "{") braces++;
            else if (character === "}") braces--;
            else if (character === "!" && !parentheses && !brackets && !braces) important = index;
        }
        let priority = "";
        if (important >= 0 && value.slice(important + 1).trim().toLowerCase() === "important") {
            value = value.slice(0, important).trimEnd();
            if (!value) throw templateError("Invalid style declaration: '!important' requires a value");
            priority = "important";
        }
        declarations.set(name, { name, value, priority });
    }
    return [...declarations.values()];
}

// XTemplate parser

function parseFor(value, recursive, element, parse) {
    const separator = value.indexOf(" in ");
    if (separator <= 0 || value.indexOf(" in ", separator + 4) >= 0) throw templateError(`Invalid ${recursive ? "x-recursive" : "x-for"} expression '${value}'.`, element);
    const variablesText = value.slice(0, separator).trim();
    const collectionText = value.slice(separator + 4).trim();
    const variables = variablesText.startsWith("(") && variablesText.endsWith(")")
        ? variablesText.slice(1, -1).split(",").map(item => item.trim()) : [variablesText];
    if (!collectionText || variables.length < 1 || variables.length > (recursive ? 3 : 2) || variables.some(item => !IDENTIFIER.test(item))) throw templateError(`Invalid ${recursive ? "x-recursive" : "x-for"} variables or collection.`, element);
    return {
        item: variables[0], index: variables[1] ?? "index", absoluteIndex: variables[2] ?? "indexAbsolute", indent: "indent",
        collection: parse(collectionText)
    };
}

function ensureOpaqueContentAllowed(element) {
    const visit = node => {
        for (const child of node.childNodes) {
            if (child.nodeType !== 1) continue;
            const name = child.localName.toLowerCase();
            if (name === "script" || name === "style") throw templateError(`Element <${name}> is not allowed in an XTemplate.`, child);
            if (child.hasAttribute("style")) throw templateError("Inline style attributes are not supported inside x-pre raw content.", child);
            visit(child);
        }
    };
    visit(element);
}

function parseInterpolatedText(value, allowedIdentifiers) {
    const nodes = [];
    let position = 0;
    while (position < value.length) {
        const start = value.indexOf("{{", position);
        if (start < 0) { if (position < value.length) nodes.push({ type: "text", value: value.slice(position) }); break; }
        if (start > position) nodes.push({ type: "text", value: value.slice(position, start) });
        const end = value.indexOf("}}", start + 2);
        if (end < 0) throw templateError("Interpolation is missing '}}'.");
        const source = value.slice(start + 2, end);
        if (!source.trim()) throw templateError("Interpolation expression is empty.");
        nodes.push({ type: "interpolation", expression: parseExpression(source, allowedIdentifiers) });
        position = end + 2;
    }
    return nodes;
}

function validateConditionalChains(nodes) {
    let state = "none";
    for (const node of nodes) {
        if (node.type === "element") {
            const kind = node.structural?.kind;
            if (kind === "if") state = "open";
            else if (kind === "elseif") {
                if (state !== "open") throw templateError("Directive 'x-elseif' requires a preceding 'x-if' or 'x-elseif' conditional chain.");
            } else if (kind === "else") {
                if (state !== "open") throw templateError("Directive 'x-else' requires a preceding conditional chain.");
                state = "closed";
            } else state = "none";
        } else if (node.type !== "comment" && (node.type !== "text" || node.value.trim())) state = "none";
    }
}

function parseDomNode(node, allowedIdentifiers) {
    if (node.nodeType === 3) return parseInterpolatedText(node.nodeValue ?? "", allowedIdentifiers);
    if (node.nodeType === 8) return [{ type: "comment", value: node.nodeValue ?? "" }];
    if (node.nodeType !== 1) return [];
    const element = node;
    const name = element.localName.toLowerCase();
    if (name === "script" || name === "style") throw templateError(`Element <${name}> is not allowed in an XTemplate.`, element);
    if (name.startsWith("x:")) throw templateError(`Invalid X template node <${name}>.`, element);

    const rawAttributes = [...element.attributes].map(attribute => ({ name: attribute.name, value: attribute.value }));
    const primary = rawAttributes.filter(attribute => PRIMARY_STRUCTURAL_DIRECTIVES.has(attribute.name));
    if (primary.length > 1) throw templateError("An element cannot contain more than one primary structural directive.", element);
    const parse = source => parseExpression(source, allowedIdentifiers);
    let structural = null;
    if (primary.length) {
        const attribute = primary[0];
        const kind = attribute.name.slice(2);
        if ((kind === "else" || kind === "once") && attribute.value) throw templateError(`Directive '${attribute.name}' cannot have a value.`, element);
        if (kind === "if" || kind === "elseif") {
            if (!attribute.value.trim()) throw templateError(`Directive '${attribute.name}' requires an expression.`, element);
            structural = { kind, expression: parse(attribute.value) };
        } else if (kind === "for" || kind === "recursive") {
            structural = { kind, loop: parseFor(attribute.value, kind === "recursive", element, parse) };
        } else structural = { kind };
    }

    const loopIdentifiers = new Set(allowedIdentifiers);
    if (structural?.kind === "for" || structural?.kind === "recursive") {
        loopIdentifiers.add(structural.loop.item);
        loopIdentifiers.add(structural.loop.index);
        if (structural.kind === "recursive") {
            loopIdentifiers.add(structural.loop.absoluteIndex);
            loopIdentifiers.add(structural.loop.indent);
        }
    }
    const parseScoped = source => parseExpression(source, loopIdentifiers);
    const operations = [];
    let content = null;
    let pre = false;
    let key = null;
    let recursiveWrapper = null;
    let hasConditionalClass = false;
    const staticAttributes = {};

    for (const attribute of rawAttributes) {
        const directive = attribute.name;
        const value = attribute.value;
        if (PRIMARY_STRUCTURAL_DIRECTIVES.has(directive)) continue;
        if (directive === "x-key") { key = value; continue; }
        if (directive === "x-recursive-wrapper") { recursiveWrapper = value; continue; }
        if (directive === "x-pre") { if (value) throw templateError("Directive 'x-pre' cannot have a value.", element); pre = true; continue; }
        if (directive === "x-text" || directive === "x-html" || directive === "x-children") {
            if (!value.trim()) throw templateError(`Directive '${directive}' requires an expression.`, element);
            if (content) throw templateError(`Element cannot combine '${content.kind}' and '${directive}'.`, element);
            content = { kind: directive, expression: parseScoped(value) };
            continue;
        }
        if (directive === "x-model") {
            if (!value.trim()) throw templateError("Directive 'x-model' requires an expression.", element);
            const expression = parseScoped(value);
            if (!assignmentPath(expression)) throw templateError("Directive 'x-model' requires an assignable XTemplate expression.", element);
            operations.push({ kind: "model", expression });
            continue;
        }
        if (directive === "x-attr") { operations.push({ kind: "attr-spread", expression: parseScoped(value) }); continue; }
        if (directive.startsWith("x-attr:[") && directive.endsWith("]")) {
            const source = directive.slice(8, -1);
            if (!source.trim()) throw templateError("Dynamic attribute name expression is empty.", element);
            operations.push({ kind: "attr-dynamic", name: parseScoped(source), expression: parseScoped(value) });
            continue;
        }
        if (directive.startsWith("x-attr:")) {
            const attributeName = directive.slice(7);
            if (!isValidAttributeName(attributeName) || attributeName.toLowerCase() === "style") throw templateError(`Invalid attribute name '${attributeName}'.`, element);
            operations.push({ kind: "attr", name: attributeName, expression: parseScoped(value) });
            continue;
        }
        if (directive === "x-prop") { operations.push({ kind: "prop-spread", expression: parseScoped(value) }); continue; }
        if (directive.startsWith("x-prop:[") && directive.endsWith("]")) {
            const source = kebabToCamel(directive.slice(8, -1));
            if (!source.trim()) throw templateError("Dynamic property name expression is empty.", element);
            operations.push({ kind: "prop-dynamic", name: parseScoped(source), expression: parseScoped(value) });
            continue;
        }
        if (directive.startsWith("x-prop:")) {
            const propertyName = directive.slice(7);
            if (!isValidAttributeName(propertyName)) throw templateError(`Invalid property name '${propertyName}'.`, element);
            operations.push({ kind: "prop", name: kebabToCamel(propertyName), expression: parseScoped(value) });
            continue;
        }
        if (directive === "x-style") { operations.push({ kind: "style-spread", expression: parseScoped(value) }); continue; }
        if (directive.startsWith("x-style:")) {
            const styleName = directive.slice(8);
            if (!isValidStyleName(styleName)) throw templateError(`Invalid style property name '${styleName}'.`, element);
            operations.push({ kind: "style", name: normalizeStyleName(styleName), expression: parseScoped(value) });
            continue;
        }
        if (directive.startsWith("x-class:")) {
            const className = directive.slice(8);
            if (!className || /\s/.test(className)) throw templateError("Directive 'x-class' requires a class name.", element);
            hasConditionalClass = true;
            operations.push({ kind: "class", name: className, expression: parseScoped(value) });
            continue;
        }
        if (directive === "x-show") { operations.push({ kind: "show", expression: parseScoped(value) }); continue; }
        if (directive.startsWith("x-on:")) {
            const eventName = directive.slice(5);
            if (!eventName || eventName.split(".").some(part => !IDENTIFIER.test(part)) || !value.trim()) throw templateError("Invalid x-on event name, modifier, or command.", element);
            operations.push({ kind: "event", name: eventName, command: value });
            continue;
        }
        if (directive.startsWith("x-")) throw templateError(`Unsupported XTemplate directive '${directive}'.`, element);
        if (directive === "style") operations.push({ kind: "static-style", declarations: parseStyleDeclarations(value) });
        else {
            operations.push({ kind: "static-attr", name: directive, value });
            staticAttributes[directive] = value;
        }
    }

    if (key != null) {
        if (structural?.kind !== "for" && structural?.kind !== "recursive") throw templateError("Directive 'x-key' requires 'x-for' or 'x-recursive'.", element);
        if (!IDENTIFIER.test(key)) throw templateError("Directive 'x-key' requires an XTemplate member name.", element);
    }
    if (recursiveWrapper != null) {
        if (structural?.kind !== "recursive") throw templateError("Directive 'x-recursive-wrapper' requires x-recursive.", element);
        if (!/^[A-Za-z][A-Za-z0-9:_-]*$/.test(recursiveWrapper)) throw templateError("x-recursive-wrapper requires a tag name.", element);
        recursiveWrapper = recursiveWrapper.toLowerCase();
    }
    if (name === "select" && rawAttributes.some(attribute => attribute.name === "multiple") && operations.some(operation => operation.kind === "model")) {
        throw templateError("x-model on select[multiple] is not supported.", element);
    }
    if (content && element.childNodes.length) throw templateError(`Directive '${content.kind}' requires an empty element.`, element);
    if (pre && content) throw templateError("x-pre cannot be combined with a content directive.", element);

    let children = [];
    let rawHtml = null;
    if (pre) {
        ensureOpaqueContentAllowed(element);
        rawHtml = element.innerHTML;
    } else {
        for (const child of element.childNodes) children.push(...parseDomNode(child, loopIdentifiers));
        validateConditionalChains(children);
    }

    if (hasConditionalClass) {
        const staticClass = rawAttributes.find(attribute => attribute.name === "class")?.value;
        if (staticClass) {
            const classIndex = operations.findIndex(operation => operation.kind === "static-attr" && operation.name === "class");
            if (classIndex >= 0) operations.splice(classIndex, 1);
        }
    }
    return [{ type: "element", name, operations, staticAttributes, structural, content, pre, rawHtml, children, key, recursiveWrapper, staticClass: hasConditionalClass ? rawAttributes.find(attribute => attribute.name === "class")?.value ?? "" : "" }];
}

export function parseTemplate(template) {
    if (typeof template !== "string") throw new TypeError("XTemplate source must be a string.");
    const source = document.createElement("template");
    source.innerHTML = template.replace(/\r\n?/g, "\n").trim();
    const children = [];
    for (const child of source.content.childNodes) children.push(...parseDomNode(child, new Set(["state"])));
    validateConditionalChains(children);
    return freeze({ type: "root", children });
}

// static template analysis

export function collectDependencies(templateAst, currentComponentName = null) {
    const dependencies = new Map();
    const current = typeof currentComponentName === "string" ? currentComponentName.toLowerCase() : null;
    const visit = (nodes, ancestors) => {
        for (const node of nodes) {
            if (node.type !== "element") continue;
            if (node.name.includes("-") && node.name !== current) {
                const resource = `component:${node.name}`;
                const paths = dependencies.get(resource) ?? [];
                if (!paths.some(path => path.length === ancestors.length && path.every((value, index) => value === ancestors[index]))) paths.push([...ancestors]);
                dependencies.set(resource, paths);
            }
            if (!node.pre) visit(node.children, [...ancestors, node.name]);
        }
    };
    visit(templateAst.children, []);
    return [...dependencies].map(([resource, ancestorPaths]) => ({ resource, ancestorPaths }));
}

export function collectSlots(templateAst) {
    const result = [];
    const found = new Set();
    const visit = nodes => {
        for (const node of nodes) {
            if (node.type !== "element") continue;
            if (node.name === "slot") {
                if (node.operations.some(operation => operation.kind === "attr-spread" || operation.kind === "attr-dynamic" || operation.kind === "attr" && operation.name === "name")) throw templateError("Slot names must be declared statically with the 'name' attribute.");
                const name = node.staticAttributes.name ?? "";
                if (!found.has(name)) { found.add(name); result.push(name); }
            }
            if (!node.pre) visit(node.children);
        }
    };
    visit(templateAst.children);
    return result;
}

// XTemplate interpreter

function childScope(scope, values) {
    return Object.assign(Object.create(null), scope, values);
}

function renderBasicElement(node, index, scope, environment, extraOptions = null, recursiveChildren = null) {
    const { utils, i18n, handler, invalidate } = environment;
    const attrs = {};
    const props = {};
    const styles = {};
    const events = {};
    const options = { index, ...extraOptions };
    const classes = node.staticClass ? node.staticClass.split(" ").filter(Boolean) : [];

    for (const operation of node.operations) {
        switch (operation.kind) {
            case "static-attr": attrs[operation.name] = utils.rewriteAttribute(node.name, node.staticAttributes, operation.name, operation.value); break;
            case "attr-spread": Object.assign(attrs, utils.expr.attributes(evaluateExpression(operation.expression, scope, utils, i18n))); break;
            case "attr": attrs[operation.name] = evaluateExpression(operation.expression, scope, utils, i18n); break;
            case "attr-dynamic": Object.assign(attrs, utils.expr.dynamicArgument(evaluateExpression(operation.name, scope, utils, i18n), evaluateExpression(operation.expression, scope, utils, i18n))); break;
            case "prop-spread": Object.assign(props, utils.expr.properties(evaluateExpression(operation.expression, scope, utils, i18n))); break;
            case "prop": props[operation.name] = evaluateExpression(operation.expression, scope, utils, i18n); break;
            case "prop-dynamic": Object.assign(props, utils.expr.dynamicProperty(evaluateExpression(operation.name, scope, utils, i18n), evaluateExpression(operation.expression, scope, utils, i18n))); break;
            case "static-style": for (const declaration of operation.declarations) styles[declaration.name] = { value: utils.rewriteStyleValue(declaration.value), priority: declaration.priority }; break;
            case "style-spread": Object.assign(styles, utils.expr.styles(evaluateExpression(operation.expression, scope, utils, i18n))); break;
            case "style": Object.assign(styles, utils.expr.style(operation.name, evaluateExpression(operation.expression, scope, utils, i18n))); break;
            case "class": if (utils.expr.truthy(evaluateExpression(operation.expression, scope, utils, i18n))) classes.push(operation.name); break;
            case "show": options.show = utils.expr.truthy(evaluateExpression(operation.expression, scope, utils, i18n)); break;
            case "event": events[operation.name] = event => handler(operation.command, event); break;
            case "model": {
                let propertyName = "value";
                let propertyValue;
                if (node.name === "input") {
                    const type = node.staticAttributes.type;
                    if (type === "range") { propertyName = "valueAsNumber"; propertyValue = evaluateExpression(operation.expression, scope, utils, i18n); }
                    else if (type === "checkbox") { propertyName = "checked"; propertyValue = evaluateExpression(operation.expression, scope, utils, i18n); }
                    else if (type === "radio") {
                        propertyName = "checked";
                        propertyValue = function() {
                            const current = evaluateExpression(operation.expression, scope, utils, i18n);
                            return current !== null && utils.expr.scalar(current) === utils.expr.scalar(utils.expr.member(this.attrs, "value"));
                        };
                    } else propertyValue = evaluateExpression(operation.expression, scope, utils, i18n);
                } else propertyValue = evaluateExpression(operation.expression, scope, utils, i18n);
                props[propertyName] = propertyValue;
                events["change.stop"] = event => {
                    assignExpression(operation.expression, scope, utils.getInputValue(event.target), utils, i18n);
                    invalidate();
                };
                break;
            }
        }
    }
    if (classes.length) attrs.class = classes.join(" ");

    let children = null;
    if (node.pre) { options.format = "html"; children = node.rawHtml; }
    else if (node.content) {
        children = evaluateExpression(node.content.expression, scope, utils, i18n);
        if (node.content.kind === "x-html") { options.format = "html"; children = utils.expr.scalar(children); }
        else if (node.content.kind === "x-text") children = utils.expr.scalar(children);
        else options.format = "node";
    } else if (node.children.length) {
        children = renderChildren(node.children, scope, environment);
        return utils.createVDOM(node.name, Object.keys(attrs).length ? attrs : null, Object.keys(props).length ? props : null,
            Object.keys(styles).length ? styles : null, Object.keys(events).length ? events : null, options, children, recursiveChildren);
    }
    return utils.createVDOM(node.name, Object.keys(attrs).length ? attrs : null, Object.keys(props).length ? props : null,
        Object.keys(styles).length ? styles : null, Object.keys(events).length ? events : null, options, children);
}

function renderRecursive(node, index, scope, environment) {
    const { utils, i18n } = environment;
    const loop = node.structural.loop;
    const forType = node.key ? "key" : "position";
    const recurse = (items, absoluteIndex, indent, wrapper) => {
        const result = [utils.createVDOM("#comment", null, null, null, null, { index: index - 1, forType }, "x-for-start")];
        const collection = utils.expr.collection(items);
        for (let itemIndex = 0; itemIndex < collection.length; itemIndex++) {
            const item = collection[itemIndex];
            const local = childScope(scope, { [loop.item]: item, [loop.index]: itemIndex, [loop.absoluteIndex]: absoluteIndex, [loop.indent]: indent });
            const recursiveChildren = node.children.length
                ? recurse(utils.expr.member(item, "children"), absoluteIndex + 1, indent + 1, node.recursiveWrapper)
                : null;
            const options = node.key ? { key: utils.expr.member(item, node.key) } : null;
            result.push(renderBasicElement(node, index, local, environment, options, recursiveChildren));
            absoluteIndex++;
        }
        result.push(utils.createVDOM("#comment", null, null, null, null, { index: index - 1, forType }, "x-for-end"));
        return wrapper ? [utils.createVDOM(wrapper, null, null, null, null, { index: 1 }, result)] : result;
    };
    return recurse(evaluateExpression(loop.collection, scope, utils, i18n), 0, 0, null);
}

function renderElement(node, index, scope, environment, chain) {
    const structural = node.structural;
    if (!structural) return [renderBasicElement(node, index, scope, environment)];
    const { utils, i18n, renderCount } = environment;
    if (structural.kind === "if") {
        chain.matched = utils.expr.truthy(evaluateExpression(structural.expression, scope, utils, i18n));
        return chain.matched ? [renderBasicElement(node, index, scope, environment)] : [utils.createVDOM("#comment", null, null, null, null, { index }, "x-if")];
    }
    if (structural.kind === "elseif") {
        const selected = !chain.matched && utils.expr.truthy(evaluateExpression(structural.expression, scope, utils, i18n));
        if (selected) chain.matched = true;
        return selected ? [renderBasicElement(node, index, scope, environment)] : [utils.createVDOM("#comment", null, null, null, null, { index }, "x-elseif")];
    }
    if (structural.kind === "else") return !chain.matched ? [renderBasicElement(node, index, scope, environment)] : [utils.createVDOM("#comment", null, null, null, null, { index }, "x-else")];
    if (structural.kind === "once") return renderCount === 0
        ? [renderBasicElement(node, index, scope, environment)]
        : [utils.createVDOM(node.name, null, null, null, null, { once: true })];
    if (structural.kind === "for") {
        const loop = structural.loop;
        const forType = node.key ? "key" : "position";
        const result = [utils.createVDOM("#comment", null, null, null, null, { index, forType }, "x-for-start")];
        const collection = utils.expr.collection(evaluateExpression(loop.collection, scope, utils, i18n));
        for (let itemIndex = 0; itemIndex < collection.length; itemIndex++) {
            const item = collection[itemIndex];
            const local = childScope(scope, { [loop.item]: item, [loop.index]: itemIndex });
            const options = node.key ? { key: utils.expr.member(item, node.key) } : null;
            result.push(renderBasicElement(node, index, local, environment, options));
        }
        result.push(utils.createVDOM("#comment", null, null, null, null, { index, forType }, "x-for-end"));
        return result;
    }
    if (structural.kind === "recursive") return renderRecursive(node, index, scope, environment);
    throw runtimeError(`Unsupported structural directive '${structural.kind}'`);
}

function renderChildren(nodes, scope, environment) {
    const result = [];
    const chain = { matched: false };
    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (node.type === "text") {
            result.push(environment.utils.createVDOM("#text", null, null, null, null, { index }, node.value));
            if (node.value.trim()) chain.matched = false;
        } else if (node.type === "interpolation") {
            result.push(environment.utils.createVDOM("#text", null, null, null, null, { index }, environment.utils.expr.scalar(evaluateExpression(node.expression, scope, environment.utils, environment.i18n))));
            chain.matched = false;
        } else if (node.type === "comment") {
            result.push(environment.utils.createVDOM("#comment", null, null, null, null, { index }, node.value));
        } else {
            if (!CONDITIONAL_DIRECTIVES.has(node.structural?.kind)) chain.matched = false;
            result.push(...renderElement(node, index, scope, environment, chain));
        }
    }
    return result;
}

export function renderTemplate(templateAst, state, handler, invalidate, utils = XTemplateRuntimeUtils, i18n = null, renderCount = 0) {
    const scope = Object.assign(Object.create(null), { state });
    return renderChildren(templateAst.children, scope, { handler, invalidate, utils, i18n, renderCount });
}

// templateRenderer adapter / render-engine factory

export function createClientTemplateRenderer(template, context = {}) {
    const templateAst = parseTemplate(template);
    const dependencies = collectDependencies(templateAst, context.resourceName);
    const slots = collectSlots(templateAst);
    return Object.freeze({
        render: (state, handler, invalidate, utils, i18n, renderCount) => renderTemplate(templateAst, state, handler, invalidate, utils, i18n, renderCount),
        dependencies: Object.freeze(dependencies),
        slots: Object.freeze(slots)
    });
}

export default function createRenderEngineFactoryXClient(template, context, templateRenderer) {
    void templateRenderer;
    const interpretedRenderer = createClientTemplateRenderer(template, context);
    return createRenderEngineFactoryX(template, context, interpretedRenderer);
}
