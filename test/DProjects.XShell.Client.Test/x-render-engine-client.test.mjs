import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

class FixtureNode {
    constructor(nodeType, nodeValue = null) {
        this.nodeType = nodeType;
        this.nodeValue = nodeValue;
        this.childNodes = [];
    }
}

class FixtureElement extends FixtureNode {
    constructor(localName, attributes = {}, children = [], innerHTML = "") {
        super(1);
        this.localName = localName;
        this.attributes = Object.entries(attributes).map(([name, value]) => ({ name, value }));
        this.childNodes = children;
        this.innerHTML = innerHTML;
    }
    hasAttribute(name) { return this.attributes.some(attribute => attribute.name === name); }
}

const text = value => new FixtureNode(3, value);
const element = (name, attributes, children, innerHTML) => new FixtureElement(name, attributes, children, innerHTML);
const fixtures = new Map();
let templateParseCount = 0;

class FixtureTemplate {
    content = { childNodes: [] };
    set innerHTML(value) {
        templateParseCount++;
        const create = fixtures.get(value);
        if (!create) throw new Error(`Missing fixture DOM for ${value}`);
        this.content = { childNodes: create() };
    }
}

class MatchElement {
    constructor(tag) { this.tag = tag; this.attrs = {}; }
    setAttribute(name, value) { this.attrs[name] = value; }
    matches(selector) {
        if (selector === this.tag) return true;
        return selector === "input[type=image]" && this.tag === "input" && this.attrs.type === "image";
    }
}

globalThis.HTMLElement = class {};
globalThis.CSSStyleSheet = class { replaceSync() {} };
globalThis.customElements = { get() {}, define() {} };
globalThis.window = { customElements: globalThis.customElements, location: { origin: "https://example.test" } };
globalThis.document = {
    createElement(tag) { return tag.toLowerCase() === "template" ? new FixtureTemplate() : new MatchElement(tag.toLowerCase()); },
    implementation: { createHTMLDocument: () => ({ createElement: tag => new MatchElement(tag.toLowerCase()) }) }
};

const modulePath = "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/render-engines/x-client.js";
const { default: createRenderEngineFactoryXClient, createClientTemplateRenderer, parseExpression, evaluateExpression, assignExpression } = await import(modulePath);
const { XTemplateRuntimeUtils } = await import("../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/render-engines/x.js");
const renderUtils = Object.assign(Object.create(XTemplateRuntimeUtils), {
    rewriteAttribute(tag, attrs, name, value) { void tag; void attrs; void name; return value; },
    rewriteStyleValue(value) { return value; }
});

test("x-client expression parser evaluates the current restricted grammar through canonical runtime helpers", () => {
    const scope = { state: { total: 4, ok: false, fallback: " yes ", items: [{ name: "first" }] } };
    const cases = [
        ["null", null], ["true", true], ["'text'", "text"], ["state.items[0].name", "first"],
        ["state.total + 2 * 3", 10], ["state.total >= 4 && state.ok", false],
        ["state.ok ? 'yes' : 'no' | upper", "NO"], ["state.missing ?? state.fallback | trim | upper", "YES"]
    ];
    for (const [source, expected] of cases) {
        const ast = parseExpression(source, ["state"]);
        assert.deepEqual(evaluateExpression(ast, scope), expected, source);
        assert.equal(Object.isFrozen(ast), true, source);
    }
});

test("x-client expression parser rejects unknown syntax, globals, protected members, and invalid model targets", () => {
    for (const source of ["window.location", "state.value = 1", "state.value++", "state.constructor", "state['__proto__']"]) {
        const action = () => {
            const ast = parseExpression(source, ["state"]);
            return evaluateExpression(ast, { state: {} });
        };
        assert.throws(action, /XTemplate (expression|runtime) error/, source);
    }
    assert.throws(() => assignExpression(parseExpression("state.value + 1", ["state"]), { state: { value: 1 } }, 2), /assignable/);
});

test("x-client model assignment uses the strict existing-member and collection-bound rules", () => {
    const scope = { state: { customer: { name: "old" }, items: ["first"] } };
    assignExpression(parseExpression("state.customer.name", ["state"]), scope, "new");
    assignExpression(parseExpression("state.items[0]", ["state"]), scope, "updated");
    assert.deepEqual(scope.state, { customer: { name: "new" }, items: ["updated"] });
    assert.throws(() => assignExpression(parseExpression("state.customer.missing", ["state"]), scope, "x"), /member does not exist/);
    assert.throws(() => assignExpression(parseExpression("state.items[2]", ["state"]), scope, "x"), /out of range/);
});

const paritySource = '<section><x-card><slot name="footer"></slot><p x-if="state.ok">{{ state.label | upper }}</p><p x-else>fallback</p><li x-for="item in state.items" x-key="id" x-attr:data-id="item.id">{{ item.label }}</li></x-card></section>';
fixtures.set(paritySource, () => [element("section", {}, [
    element("x-card", {}, [
        element("slot", { name: "footer" }, []),
        element("p", { "x-if": "state.ok" }, [text("{{ state.label | upper }}")]),
        element("p", { "x-else": "" }, [text("fallback")]),
        element("li", { "x-for": "item in state.items", "x-key": "id", "x-attr:data-id": "item.id" }, [text("{{ item.label }}")])
    ])
])]);

function compiledParityRenderer(state, handler, invalidate, utils, i18n) {
    void handler; void invalidate;
    let matched = false;
    const cardChildren = [
        utils.createVDOM("slot", { name: utils.rewriteAttribute("slot", { name: "footer" }, "name", "footer") }, null, null, null, { index: 0 }),
        ...((matched = utils.expr.truthy(state.ok))
            ? [utils.createVDOM("p", null, null, null, null, { index: 1 }, [utils.createVDOM("#text", null, null, null, null, { index: 0 }, utils.expr.scalar(utils.expr.transform(state.label, "upper", () => [], i18n)))])]
            : [utils.createVDOM("#comment", null, null, null, null, { index: 1 }, "x-if")]),
        ...(!matched
            ? [utils.createVDOM("p", null, null, null, null, { index: 2 }, [utils.createVDOM("#text", null, null, null, null, { index: 0 }, "fallback")])]
            : [utils.createVDOM("#comment", null, null, null, null, { index: 2 }, "x-else")]),
        utils.createVDOM("#comment", null, null, null, null, { index: 3, forType: "key" }, "x-for-start"),
        ...utils.expr.collection(state.items).map(item => utils.createVDOM("li", { "data-id": item.id }, null, null, null, { index: 3, key: utils.expr.member(item, "id") }, [utils.createVDOM("#text", null, null, null, null, { index: 0 }, utils.expr.scalar(item.label))])),
        utils.createVDOM("#comment", null, null, null, null, { index: 3, forType: "key" }, "x-for-end")
    ];
    return [utils.createVDOM("section", null, null, null, null, { index: 0 }, [utils.createVDOM("x-card", null, null, null, null, { index: 0 }, cardChildren)])];
}

test("x-client parses once, discovers compatible metadata, and emits compiled-renderer VDOM", () => {
    const before = templateParseCount;
    const renderer = createClientTemplateRenderer(paritySource, { resourceName: "x-host" });
    assert.equal(templateParseCount, before + 1);
    assert.deepEqual(renderer.dependencies, [{ resource: "component:x-card", ancestorPaths: [["section"]] }]);
    assert.deepEqual(renderer.slots, ["footer"]);

    for (const state of [
        { ok: true, label: "ready", items: [{ id: 1, label: "one" }, { id: 2, label: "two" }] },
        { ok: false, label: "ignored", items: [{ id: 2, label: "two updated" }] }
    ]) {
        const interpreted = renderer.render(state, () => {}, () => {}, renderUtils, null, 0);
        const compiled = compiledParityRenderer(state, () => {}, () => {}, renderUtils, null, 0);
        assert.deepEqual(interpreted, compiled);
    }
    assert.equal(templateParseCount, before + 1, "rendering must not parse the template again");
});

const bindingsSource = '<input type="checkbox" x-model="state.checked"><button class="base" x-class:active="state.active" x-style:color="state.color" x-show="state.visible" x-on:click.prevent="save">Go</button>';
fixtures.set(bindingsSource, () => [
    element("input", { type: "checkbox", "x-model": "state.checked" }, []),
    element("button", { class: "base", "x-class:active": "state.active", "x-style:color": "state.color", "x-show": "state.visible", "x-on:click.prevent": "save" }, [text("Go")])
]);

test("x-client emits model, event, class, style, and show data for x.js without touching the DOM", () => {
    const renderer = createClientTemplateRenderer(bindingsSource, {});
    const state = { checked: false, active: true, color: "red", visible: false };
    const commands = [];
    let invalidations = 0;
    const vdom = renderer.render(state, (command, event) => commands.push([command, event.type]), () => invalidations++, renderUtils, null, 0);
    assert.equal(vdom[0].props.checked, false);
    assert.equal(vdom[1].attrs.class, "base active");
    assert.deepEqual(vdom[1].styles, { color: { value: "red", priority: "" } });
    assert.equal(vdom[1].options.show, false);
    vdom[0].events["change.stop"]({ target: { localName: "input", type: "checkbox", checked: true } });
    assert.equal(state.checked, true);
    assert.equal(invalidations, 1);
    vdom[1].events["click.prevent"]({ type: "click" });
    assert.deepEqual(commands, [["save", "click"]]);
});

test("x-client factory ignores a server artifact and delegates its interpreted artifact to x.js", () => {
    const before = templateParseCount;
    const factory = createRenderEngineFactoryXClient(bindingsSource, {}, { render() { throw new Error("must not be used"); }, dependencies: [], slots: [] });
    assert.equal(templateParseCount, before + 1);
    assert.deepEqual(factory.dependencies, []);
    assert.deepEqual(factory.slots, []);
});

const resourceSource = '<img src="images/card.png" style="background:url(icons/card.svg); color:red"><x-lazy><x-heavy></x-heavy></x-lazy><x-shared></x-shared>';
fixtures.set(resourceSource, () => [
    element("img", { src: "images/card.png", style: "background:url(icons/card.svg); color:red" }, []),
    element("x-lazy", {}, [element("x-heavy", {}, [])]),
    element("x-shared", {}, [])
]);

test("x-client delegates static URL/style rewriting and lazy dependency filtering to canonical x.js utilities", () => {
    const renderer = createClientTemplateRenderer(resourceSource, {});
    const calls = [];
    const utils = Object.assign(Object.create(XTemplateRuntimeUtils), {
        rewriteAttribute(tag, attrs, name, value) { calls.push([tag, attrs, name, value]); return `/rewritten/${value}`; },
        rewriteStyleValue(value) { return value.replace("icons/card.svg", "/rewritten/icons/card.svg"); }
    });
    const vdom = renderer.render({}, () => {}, () => {}, utils, null, 0);
    assert.equal(vdom[0].attrs.src, "/rewritten/images/card.png");
    assert.deepEqual(vdom[0].styles, {
        background: { value: "url(/rewritten/icons/card.svg)", priority: "" },
        color: { value: "red", priority: "" }
    });
    assert.deepEqual(calls, [["img", { src: "images/card.png" }, "src", "images/card.png"]]);

    const factory = createRenderEngineFactoryXClient(resourceSource, { componentLazy: "x-lazy" });
    assert.deepEqual(factory.dependencies, ["component:x-lazy", "component:x-shared"]);
});

const structuralSource = '<ul><li x-for="(group,groupIndex) in state.groups"><span x-for="item in group">{{ groupIndex }}:{{ item }}</span></li></ul><li x-recursive="(item,index,indexAbsolute) in state.tree" x-key="id" x-recursive-wrapper="ul"><b x-text="item.label"></b></li><section x-once x-text="state.once"></section><div x-pre><x-opaque>{{ state.notParsed }}</x-opaque></div>';
fixtures.set(structuralSource, () => [
    element("ul", {}, [
        element("li", { "x-for": "(group,groupIndex) in state.groups" }, [
            element("span", { "x-for": "item in group" }, [text("{{ groupIndex }}:{{ item }}")])
        ])
    ]),
    element("li", { "x-recursive": "(item,index,indexAbsolute) in state.tree", "x-key": "id", "x-recursive-wrapper": "ul" }, [
        element("b", { "x-text": "item.label" }, [])
    ]),
    element("section", { "x-once": "", "x-text": "state.once" }, []),
    element("div", { "x-pre": "" }, [element("x-opaque", {}, [text("{{ state.notParsed }}")])], "<x-opaque>{{ state.notParsed }}</x-opaque>")
]);

test("x-client supports nested positional loops, recursion, x-once, and opaque x-pre content", () => {
    const renderer = createClientTemplateRenderer(structuralSource, {});
    assert.deepEqual(renderer.dependencies, []); // x-pre descendants are intentionally opaque metadata
    const state = {
        groups: [["a", "b"]], once: "initial",
        tree: [{ id: 1, label: "root", children: [{ id: 2, label: "child", children: [] }] }]
    };
    const first = renderer.render(state, () => {}, () => {}, renderUtils, null, 0);
    const nestedLoop = first[0].children[1].children;
    assert.equal(nestedLoop[0].children, "x-for-start");
    assert.equal(nestedLoop[1].children.map(child => child.children).join(""), "0:a");
    assert.equal(nestedLoop[2].children.map(child => child.children).join(""), "0:b");
    assert.equal(first[1].children, "x-for-start");
    assert.equal(first.at(-2).children, "initial");
    assert.equal(first.at(-1).options.format, "html");
    assert.equal(first.at(-1).children, "<x-opaque>{{ state.notParsed }}</x-opaque>");

    state.once = "changed";
    const second = renderer.render(state, () => {}, () => {}, renderUtils, null, 1);
    assert.equal(second.at(-2).options.once, true);
    assert.equal(second.at(-2).children.length, 0);
});

test("x-client implementation has no runtime JavaScript compilation escape hatch", async () => {
    const source = await readFile(new URL(modulePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /\bnew\s+Function\b|\bFunction\s*\(/);
    assert.doesNotMatch(source, /javascript\s*:|createObjectURL|\bBlob\s*\(/i);
});
