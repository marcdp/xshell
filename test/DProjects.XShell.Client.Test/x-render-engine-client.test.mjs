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
    childNodes = [];

    constructor(tag) { this.tag = tag; this.attrs = {}; }
    setAttribute(name, value) { this.attrs[name] = value; }
    replaceChildren() { this.childNodes = []; }
    appendChild(child) {
        if (child.tag === "#fragment") this.childNodes.push(...child.childNodes);
        else this.childNodes.push(child);
    }
    moveBefore(child, before) {
        this.childNodes.splice(this.childNodes.indexOf(child), 1);
        this.childNodes.splice(this.childNodes.indexOf(before), 0, child);
    }
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
    createDocumentFragment() { return new MatchElement("#fragment"); },
    createComment(value) { return new FixtureNode(8, value); },
    createTextNode(value) { return text(value); },
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

test("canonical x-is tag resolution normalizes valid names and rejects invalid values", () => {
    assert.equal(XTemplateRuntimeUtils.expr.elementTag("X-Card", "div"), "x-card");
    assert.equal(XTemplateRuntimeUtils.expr.elementTag("SECTION", "div"), "section");
    assert.equal(XTemplateRuntimeUtils.expr.elementTag(null, "div"), "div");
    assert.equal(XTemplateRuntimeUtils.expr.elementTag("slot", "slot"), "slot");
    assert.equal(XTemplateRuntimeUtils.expr.elementTag("SLOT", "slot"), "slot");
    assert.equal(XTemplateRuntimeUtils.expr.elementTag("div", "slot"), "div");
    assert.equal(XTemplateRuntimeUtils.expr.elementTag(null, "slot"), "slot");
    assert.throws(() => XTemplateRuntimeUtils.expr.elementTag("slot", "div"), /cannot create an undeclared slot element/);
    assert.throws(() => XTemplateRuntimeUtils.expr.elementTag("SLOT", "div"), /cannot create an undeclared slot element/);
    for (const value of ["", "1div", "a b", "script", "style", "input", 123, false]) {
        assert.throws(() => XTemplateRuntimeUtils.expr.elementTag(value, "div"), /XTemplate runtime error: .*x-is/);
    }
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

const dynamicTagSource = '<div x-is="state.tag" x-attr:data-value="state.value" x-prop:value="state.value" x-style:color="state.color" x-on:click="select"><span>{{ state.value }}</span></div><p x-is="state.fallback">fallback</p><div x-is="item.tag" x-for="item in state.items" x-key="id">{{ item.label }}</div><div x-pre><span x-is="state.ignored">{{ state.ignored }}</span></div>';
fixtures.set(dynamicTagSource, () => [
    element("div", { "x-is": "state.tag", "x-attr:data-value": "state.value", "x-prop:value": "state.value", "x-style:color": "state.color", "x-on:click": "select" }, [element("span", {}, [text("{{ state.value }}")])]),
    element("p", { "x-is": "state.fallback" }, [text("fallback")]),
    element("div", { "x-is": "item.tag", "x-for": "item in state.items", "x-key": "id" }, [text("{{ item.label }}")]),
    element("div", { "x-pre": "" }, [element("span", { "x-is": "state.ignored" }, [text("{{ state.ignored }}")])], '<span x-is="state.ignored">{{ state.ignored }}</span>')
]);

test("x-client resolves x-is in local scopes without leaking the directive or changing static dependency discovery", () => {
    const renderer = createClientTemplateRenderer(dynamicTagSource, {});
    assert.deepEqual(renderer.dependencies, []);
    const state = {
        tag: "X-Card", fallback: null, value: "hello", color: "red", ignored: "section",
        items: [{ id: 1, tag: "article", label: "A" }, { id: 2, tag: "X-Item", label: "B" }]
    };
    const vdom = renderer.render(state, () => {}, () => {}, renderUtils, null, 0);
    assert.equal(vdom[0].tag, "x-card");
    assert.deepEqual(vdom[0].attrs, { "data-value": "hello" });
    assert.deepEqual(vdom[0].props, { value: "hello" });
    assert.deepEqual(vdom[0].styles, { color: { value: "red", priority: "" } });
    assert.equal(vdom[0].children[0].children[0].children, "hello");
    assert.equal(vdom[1].tag, "p");
    assert.deepEqual(vdom.slice(3, 5).map(node => node.tag), ["article", "x-item"]);
    assert.equal(vdom.at(-1).options.format, "html");
    assert.equal(vdom.at(-1).children, '<span x-is="state.ignored">{{ state.ignored }}</span>');
});

const dynamicSlotSource = '<slot name="header" x-is="state.tag"></slot>';
fixtures.set(dynamicSlotSource, () => [element("slot", { name: "header", "x-is": "state.tag" }, [])]);

test("x-client preserves authored slot metadata while allowing only authored slots to resolve as slot", () => {
    const renderer = createClientTemplateRenderer(dynamicSlotSource, {});
    assert.deepEqual(renderer.slots, ["header"]);
    for (const [tag, expected] of [["slot", "slot"], ["SLOT", "slot"], ["div", "div"], [null, "slot"]]) {
        assert.equal(renderer.render({ tag }, () => {}, () => {}, renderUtils, null, 0)[0].tag, expected);
    }
    const ordinary = createClientTemplateRenderer(dynamicTagSource, {});
    assert.deepEqual(ordinary.slots, []);
    assert.throws(() => ordinary.render({ tag: "slot" }, () => {}, () => {}, renderUtils, null, 0), /cannot create an undeclared slot element/);
});

for (const [source, create] of [
    ['<input x-is="state.tag">', () => [element("input", { "x-is": "state.tag" }, [])]],
    ['<div x-is="state.tag" x-model="state.value"></div>', () => [element("div", { "x-is": "state.tag", "x-model": "state.value" }, [])]],
    ['<div x-is="state.tag" x-model.input="state.value"></div>', () => [element("div", { "x-is": "state.tag", "x-model.input": "state.value" }, [])]],
    ['<div x-is></div>', () => [element("div", { "x-is": "" }, [])]]
]) fixtures.set(source, create);

test("x-client rejects unsupported x-is declarations", () => {
    assert.throws(() => createClientTemplateRenderer('<input x-is="state.tag">', {}), /void element/);
    assert.throws(() => createClientTemplateRenderer('<div x-is><\/div>', {}), /requires an expression/);
});

test("x-client composes x-is with generic x-model bindings across selected components and fallback", () => {
    const renderer = createClientTemplateRenderer('<div x-is="state.tag" x-model="state.value"><\/div>', {});
    const state = { tag: "x-first", value: "Hello" };
    let invalidations = 0;

    let vdom = renderer.render(state, () => {}, () => invalidations++, renderUtils, null, 0);
    assert.equal(vdom[0].tag, "x-first");
    assert.deepEqual(vdom[0].props, { value: "Hello" });
    vdom[0].events["change.stop"]({ target: { localName: "x-first", value: "Updated" } });
    assert.equal(state.value, "Updated");
    assert.equal(invalidations, 1);

    state.tag = "x-second";
    vdom = renderer.render(state, () => {}, () => invalidations++, renderUtils, null, 1);
    assert.equal(vdom[0].tag, "x-second");
    assert.deepEqual(vdom[0].props, { value: "Updated" });

    state.tag = null;
    vdom = renderer.render(state, () => {}, () => invalidations++, renderUtils, null, 2);
    assert.equal(vdom[0].tag, "div");
    assert.deepEqual(vdom[0].props, { value: "Updated" });
});

test("x-client x-model.input writes on input only and composes with dynamic custom elements", () => {
    const renderer = createClientTemplateRenderer('<div x-is="state.tag" x-model.input="state.value"><\/div>', {});
    const state = { tag: "x-live-field", value: "Initial" };
    let invalidations = 0;
    const vdom = renderer.render(state, () => {}, () => invalidations++, renderUtils, null, 0);

    assert.deepEqual(vdom[0].props, { value: "Initial" });
    assert.deepEqual(Object.keys(vdom[0].events), ["input.stop"]);
    assert.equal(vdom[0].events["change.stop"], undefined);
    vdom[0].events["input.stop"]({ target: { localName: "x-live-field", value: "Updated" } });
    assert.equal(state.value, "Updated");
    assert.equal(invalidations, 1);
});

for (const [source, attributes, pattern] of [
    ['<input x-model.input="state.value + 1">', { "x-model.input": "state.value + 1" }, /assignable/],
    ['<input x-model.foo="state.value">', { "x-model.foo": "state.value" }, /Unsupported XTemplate directive/],
    ['<input x-model="state.value" x-model.input="state.value">', { "x-model": "state.value", "x-model.input": "state.value" }, /more than one model directive/]
]) {
    fixtures.set(source, () => [element("input", attributes, [])]);
    test(`x-client rejects invalid model declaration: ${source}`, () => assert.throws(() => createClientTemplateRenderer(source, {}), pattern));
}

test("x-client keeps select multiple model rejection when x-is is also present", () => {
    const source = '<select multiple x-is="state.tag" x-model="state.value"><\/select>';
    fixtures.set(source, () => [element("select", { multiple: "", "x-is": "state.tag", "x-model": "state.value" }, [])]);
    assert.throws(() => createClientTemplateRenderer(source, {}), /select\[multiple\]/);
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
    assert.equal(vdom[0].events["input.stop"], undefined);
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

function keyedLoopSource(directive, key) {
    // Register the fixture DOM for a loop with the given key declaration.
    const collection = "item in state.items";
    const label = "{{ item.label }}";
    const source = `<li ${directive}="${collection}" x-key="${key}">${label}</li>`;
    fixtures.set(source, () => [element("li", { [directive]: collection, "x-key": key }, [text(label)])]);
    return source;
}

test("x-client validates x-key lists and requires a loop on the same element", () => {
    for (const directive of ["x-for", "x-recursive"]) {
        for (const key of ["id", "  id  ", "id,href", " id , href , _path2 "]) {
            assert.doesNotThrow(() => createClientTemplateRenderer(keyedLoopSource(directive, key)));
        }
        for (const key of ["", " ", "id,", ",href", "id,,href", "id, ,href", "item.id", "id || href", "id,getKey()", "id,[href]", "id,2path"]) {
            assert.throws(() => createClientTemplateRenderer(keyedLoopSource(directive, key)), /XTemplate member names/, JSON.stringify(key));
        }
    }

    const source = '<li x-key="id,href"></li>';
    fixtures.set(source, () => [element("li", { "x-key": "id,href" }, [])]);
    assert.throws(() => createClientTemplateRenderer(source), /'x-key' requires 'x-for' or 'x-recursive'/);
});

test("x-client resolves the first non-empty x-key field for both loop types", () => {
    const items = [
        { id: "first", get href() { assert.fail("Key lookup must stop at the first usable field"); } },
        { href: "/missing-id" }, { id: "", href: "/empty-id" }, { id: null, href: "/null-id" },
        { id: undefined, href: "/undefined-id" }, { id: "", href: null, path: "/third" },
        { id: 0, href: "/unused" }, { id: false, href: "/unused" }, { id: " ", href: "/unused" },
        { label: "missing" }, { id: null, href: "", path: undefined }
    ];
    const expected = ["first", "/missing-id", "/empty-id", "/null-id", "/undefined-id", "/third", 0, false, " ", undefined, undefined];
    for (const directive of ["x-for", "x-recursive"]) {
        const renderer = createClientTemplateRenderer(keyedLoopSource(directive, " id , href, path "));
        const [start, ...nodes] = renderer.render({ items }, null, null, renderUtils);
        const end = nodes.pop();
        assert.deepEqual([start.options.forType, end.options.forType], ["key", "key"], directive);
        assert.deepEqual(nodes.map(node => node.options.key), expected, directive);
        assert.ok(nodes.every(node => Object.hasOwn(node.options, "key")), directive);
        const [emptyStart, emptyItem, emptyEnd] = renderer.render({ items: [{ label: "missing" }] }, null, null, renderUtils);
        assert.deepEqual([emptyStart.options.forType, emptyItem.options.key, emptyEnd.options.forType], ["key", undefined, "key"], directive);

        const single = createClientTemplateRenderer(keyedLoopSource(directive, "id"));
        const vdom = single.render({ items: [{ id: "single" }, { id: 0 }, { id: false }, { id: "" }, { id: null }, {}] }, null, null, renderUtils);
        assert.deepEqual(vdom.slice(1, -1).map(node => node.options.key), ["single", 0, false, undefined, undefined, undefined], directive);
    }
});

test("x-client resolves recursive x-key fields independently for nested items", () => {
    const renderer = createClientTemplateRenderer(keyedLoopSource("x-recursive", "id,href,path"));
    const items = [{ id: "root", children: [{ href: "/child", children: [{ path: "/grandchild" }] }, { label: "no key value" }] }];
    const root = renderer.render({ items }, null, null, renderUtils)[1];
    const [, start, child, missing, end] = root.children;
    assert.equal(root.options.key, "root");
    assert.equal(child.options.key, "/child");
    assert.equal(child.children[2].options.key, "/grandchild");
    assert.deepEqual([start.options.forType, missing.options.key, end.options.forType], ["key", undefined, "key"]);
});

test("x-client reconciliation preserves instances when fallback keys and an undefined key move", () => {
    const factory = createRenderEngineFactoryXClient(keyedLoopSource("x-for", "id,href,path"), { services: {} });
    const host = new MatchElement("#shadow-root");
    const state = { items: [{ id: "first" }, { label: "missing" }, { href: "/last" }] };
    factory.init();
    const engine = factory.create({ host, state });
    engine.mount();
    engine.render();
    const [, first, missing, last] = host.childNodes;

    // Different candidate fields can supply the same key on a later render.
    state.items = [{ path: "/last" }, { id: "first" }, { label: "still missing" }];
    engine.render();
    assert.equal(host.childNodes[1], last);
    assert.equal(host.childNodes[2], first);
    assert.equal(host.childNodes[3], missing);
});

test("x-client reconciliation still warns about duplicate keys, including undefined keys", t => {
    const warn = t.mock.method(console, "warn", () => {});
    const factory = createRenderEngineFactoryXClient(keyedLoopSource("x-for", "id,href"), { services: {} });
    const host = new MatchElement("#shadow-root");
    const state = { items: [{ id: "same" }, { href: "same" }, {}, { id: "", href: null }] };
    factory.init();
    const engine = factory.create({ host, state });
    engine.mount();
    engine.render();
    engine.render();
    assert.equal(warn.mock.callCount(), 1);
    assert.match(warn.mock.calls[0].arguments[0], /Duplicated keys detected in x-for loop: same,$/);
});

test("x-client implementation has no runtime JavaScript compilation escape hatch", async () => {
    const source = await readFile(new URL(modulePath, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /\bnew\s+Function\b|\bFunction\s*\(/);
    assert.doesNotMatch(source, /javascript\s*:|createObjectURL|\bBlob\s*\(/i);
});
