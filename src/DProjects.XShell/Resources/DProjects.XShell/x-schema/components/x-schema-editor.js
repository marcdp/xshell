const unsafePathParts = new Set(["__proto__", "prototype", "constructor"]);

function cloneValue(value) {
    if (value === undefined || value === null || typeof value !== "object") return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}

function createContext(rootValue, value = rootValue, parent = null, location = null, path = []) {
    return { rootValue, value, parent, location, path };
}

function parsePath(path) {
    if (!path) return [];
    const parts = path.split(".").filter(Boolean);
    if (parts.some(part => unsafePathParts.has(part))) throw new Error(`Unsafe X-Schema path '${path}'.`);
    return parts;
}

function resolvePath(context, path) {
    if (path === undefined) return { value: context.value, location: context.location, path: context.path };
    const parts = parsePath(path);
    let baseContext = context;
    if (parts[0] === "$root") {
        while (baseContext.parent) baseContext = baseContext.parent;
        parts.shift();
    } else if (parts[0] === "$parent") {
        if (!context.parent) throw new Error(`Path '${path}' has no parent data context.`);
        baseContext = context.parent;
        parts.shift();
    } else if (parts[0] === "$current") {
        parts.shift();
    }
    let value = baseContext.value;
    const resolvedPath = [...baseContext.path];
    let location = baseContext.location;
    if (parts.length === 0) return { value, location, path: resolvedPath };
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (value === null || (typeof value !== "object" && typeof value !== "function")) {
            throw new Error(`Cannot resolve X-Schema path '${path}' through '${resolvedPath.join(".") || "$root"}'.`);
        }
        location = { target: value, key: part };
        value = value[part];
        resolvedPath.push(part);
    }
    return { value, location, path: resolvedPath };
}

function setBoundValue(context, bind, newValue) {
    const resolved = resolvePath(context, bind);
    if (!resolved.location) {
        throw new Error(`Cannot replace the root X-Schema value through ${bind === undefined ? "an omitted bind" : `'${bind}'`}.`);
    }
    const oldValue = resolved.location.target[resolved.location.key];
    resolved.location.target[resolved.location.key] = newValue;
    return { oldValue, newValue, path: resolved.path };
}

function initializeBoundValue(context, bind, initialValue) {
    const resolved = resolvePath(context, bind);
    if (resolved.value !== undefined) return resolved;
    setBoundValue(context, bind, cloneValue(initialValue));
    return resolvePath(context, bind);
}

function applyAttributes(target, attributes = {}) {
    for (const [name, value] of Object.entries(attributes)) {
        if (value === false || value === null) target.removeAttribute(name);
        else target.setAttribute(name, value === true ? "" : String(value));
    }
}

function applyProperties(target, properties = {}, contract, path) {
    const publicProperties = contract?.properties ?? {};
    for (const [name, value] of Object.entries(properties)) {
        if (!Object.hasOwn(publicProperties, name)) {
            throw new Error(`Component <${target.localName}> has no public property '${name}' at ${path}.`);
        }
        target[name] = cloneValue(value);
    }
}

function evaluateCondition(condition, context) {
    if (Object.hasOwn(condition, "all")) return condition.all.every(item => evaluateCondition(item, context));
    if (Object.hasOwn(condition, "any")) return condition.any.some(item => evaluateCondition(item, context));
    if (Object.hasOwn(condition, "not")) return !evaluateCondition(condition.not, context);
    const value = resolvePath(context, condition.path).value;
    if (Object.hasOwn(condition, "equals")) return Object.is(value, condition.equals);
    if (Object.hasOwn(condition, "exists")) return value !== undefined && value !== null;
    if (Object.hasOwn(condition, "in")) return condition.in.some(item => Object.is(value, item));
    if (Object.hasOwn(condition, "greaterThan")) return value > condition.greaterThan;
    if (Object.hasOwn(condition, "greaterThanOrEqual")) return value >= condition.greaterThanOrEqual;
    if (Object.hasOwn(condition, "lessThan")) return value < condition.lessThan;
    if (Object.hasOwn(condition, "lessThanOrEqual")) return value <= condition.lessThanOrEqual;
    throw new Error("Unsupported X-Schema condition predicate.");
}

function pathLabel(path) {
    return path.length ? path.join(".") : "$root";
}

function createScope(parent = null) {
    const scope = { parent, children: [], cleanups: [], conditions: [] };
    if (parent) parent.children.push(scope);
    return scope;
}

function removeFrom(array, value) {
    const index = array.indexOf(value);
    if (index !== -1) array.splice(index, 1);
}

function disposeScope(renderer, scope) {
    for (const child of [...scope.children]) disposeScope(renderer, child);
    for (const cleanup of scope.cleanups.splice(0).reverse()) cleanup();
    for (const registration of scope.conditions) removeFrom(renderer.conditions, registration);
    scope.conditions.length = 0;
    scope.children.length = 0;
    if (scope.parent) removeFrom(scope.parent.children, scope);
}

function addListener(scope, target, type, listener) {
    target.addEventListener(type, listener);
    scope.cleanups.push(() => target.removeEventListener(type, listener));
}

function registerConditions(renderer, scope, definition, context, target, parentCondition, editable = false, extraTargets = []) {
    const registration = {
        definition,
        context,
        target,
        targets: target ? [target, ...extraTargets] : extraTargets,
        parent: parentCondition,
        editable,
        effective: null
    };
    renderer.conditions.push(registration);
    scope.conditions.push(registration);
    return registration;
}

function requirePublicProperty(element, contract, property, path) {
    if (!Object.hasOwn(contract?.properties ?? {}, property)) {
        throw new Error(`Component <${element.localName}> must expose public property '${property}' at ${path}.`);
    }
}

function setConditionProperty(element, contract, property, value, path, required) {
    if (Object.hasOwn(contract?.properties ?? {}, property)) element[property] = value;
    else if (required) throw new Error(`Component <${element.localName}> must expose public property '${property}' for conditions at ${path}.`);
}

function refreshConditions(renderer) {
    for (const registration of renderer.conditions) {
        const { definition, context, parent, editable, target } = registration;
        const conditions = definition.conditions ?? {};
        const local = {
            visible: conditions.visible ? evaluateCondition(conditions.visible, context) : true,
            enabled: conditions.enabled ? evaluateCondition(conditions.enabled, context) : true,
            readonly: conditions.readonly ? evaluateCondition(conditions.readonly, context) : false,
            required: conditions.required ? evaluateCondition(conditions.required, context) : (definition.required ?? false)
        };
        const inherited = parent?.effective ?? { visible: true, enabled: true, readonly: false };
        registration.effective = {
            visible: inherited.visible && local.visible,
            enabled: inherited.enabled && local.enabled,
            readonly: inherited.readonly || local.readonly,
            required: local.required
        };
        for (const visualTarget of registration.targets) visualTarget.hidden = !registration.effective.visible;
        if (editable && target) {
            const contract = registration.contract;
            const path = registration.schemaPath;
            setConditionProperty(target, contract, "disabled", !registration.effective.enabled, path, !!conditions.enabled || !inherited.enabled);
            setConditionProperty(target, contract, "readonly", registration.effective.readonly, path, !!conditions.readonly || inherited.readonly);
            setConditionProperty(target, contract, "required", registration.effective.required, path, definition.required !== undefined || !!conditions.required);
        }
        for (const control of registration.controls ?? []) {
            const locallyAvailable = registration.controlAvailable?.get(control)?.() ?? true;
            if (registration.effective.enabled && !registration.effective.readonly && locallyAvailable) control.removeAttribute("disabled");
            else control.setAttribute("disabled", "");
        }
    }
}

async function ensureComponent(renderer, tag, schemaPath) {
    if (!tag || !tag.includes("-")) throw new Error(`Invalid Web Component tag '${tag}' at ${schemaPath}.`);
    let task = renderer.componentLoads.get(tag);
    if (!task) {
        task = renderer.loader.load(`component:${tag}`);
        renderer.componentLoads.set(tag, task);
    }
    let componentClass;
    try {
        componentClass = await task;
    } catch (error) {
        throw new Error(`Unable to load component <${tag}> at ${schemaPath}: ${error.message}`, { cause: error });
    }
    const registeredClass = globalThis.customElements?.get(tag) ?? componentClass;
    if (!registeredClass) throw new Error(`Component <${tag}> was not registered at ${schemaPath}.`);
    return registeredClass.contract ? registeredClass : componentClass;
}

async function createComponent(renderer, definition, schemaPath) {
    const componentClass = await ensureComponent(renderer, definition.tag, schemaPath);
    const contract = componentClass.contract ?? {};
    const element = document.createElement(definition.tag);
    applyAttributes(element, definition.attrs);
    applyProperties(element, definition.props, contract, schemaPath);
    return { element, contract };
}

function appendRendered(parent, rendered) {
    for (const node of Array.isArray(rendered) ? rendered : rendered.nodes) parent.append(node);
}

function childContext(context, resolved) {
    return createContext(context.rootValue, resolved.value, context, resolved.location, resolved.path);
}

function emitEditorChange(renderer, change) {
    renderer.host.dispatchEvent(new CustomEvent("change", {
        bubbles: true,
        composed: false,
        detail: {
            path: pathLabel(change.path),
            oldValue: change.oldValue,
            newValue: change.newValue,
            value: renderer.rootValue
        }
    }));
}

function getObjectCreationValue(renderer, definition) {
    return definition.type ? renderer.schema.types[definition.type]?.create : definition.create;
}

function getNewArrayItemValue(renderer, definition, schemaPath) {
    if (definition.kind === "field" && Object.hasOwn(definition, "default")) return cloneValue(definition.default);
    if (definition.kind === "object") {
        const value = getObjectCreationValue(renderer, definition);
        if (value !== undefined) return cloneValue(value);
    }
    if (definition.kind === "array" && Object.hasOwn(definition, "default")) return cloneValue(definition.default);
    throw new Error(`Array item at ${schemaPath} has no documented default/create value.`);
}

async function renderField(renderer, definition, context, schemaPath, scope, parentCondition) {
    if (!definition.tag) throw new Error(`Field at ${schemaPath} has no tag; X-Schema V0 defines no fallback component.`);
    const { element, contract } = await createComponent(renderer, definition, schemaPath);
    requirePublicProperty(element, contract, "value", schemaPath);
    if (!Object.hasOwn(contract.events ?? {}, "change")) {
        throw new Error(`Component <${definition.tag}> must expose a public 'change' event at ${schemaPath}.`);
    }
    let resolved = resolvePath(context, definition.bind);
    if (resolved.value === undefined && Object.hasOwn(definition, "default")) {
        resolved = initializeBoundValue(context, definition.bind, definition.default);
    }
    element.value = resolved.value;
    if (definition.reference?.source?.startsWith("$")) {
        requirePublicProperty(element, contract, "domain", schemaPath);
        const source = resolvePath(context, definition.reference.source).value;
        if (!Array.isArray(source)) throw new Error(`Reference source '${definition.reference.source}' is not an array at ${schemaPath}.`);
        element.domain = source.map(item => ({ value: item?.[definition.reference.key], label: item?.[definition.reference.label] }));
    }
    const listener = event => {
        if (event.target !== element) return;
        const newValue = event.detail && Object.hasOwn(event.detail, "newValue") ? event.detail.newValue : element.value;
        const change = setBoundValue(context, definition.bind, newValue);
        refreshConditions(renderer);
        emitEditorChange(renderer, change);
    };
    addListener(scope, element, "change", listener);
    const registration = registerConditions(renderer, scope, definition, context, element, parentCondition, true);
    registration.contract = contract;
    registration.schemaPath = schemaPath;
    return { nodes: [element], condition: registration };
}

async function renderContainer(renderer, definition, context, schemaPath, scope, parentCondition) {
    const { element } = await createComponent(renderer, definition, schemaPath);
    const registration = registerConditions(renderer, scope, definition, context, element, parentCondition);
    const children = await renderChildren(renderer, definition.children, context, `${schemaPath}/children`, scope, registration);
    appendRendered(element, children);
    return { nodes: [element], condition: registration };
}

async function renderObject(renderer, definition, context, schemaPath, scope, parentCondition) {
    let resolved = resolvePath(context, definition.bind);
    if (resolved.value === undefined) {
        const creationValue = getObjectCreationValue(renderer, definition);
        if (creationValue !== undefined) resolved = initializeBoundValue(context, definition.bind, creationValue);
    }
    if (resolved.value === null || typeof resolved.value !== "object" || Array.isArray(resolved.value)) {
        throw new Error(`Object binding '${pathLabel(resolved.path)}' at ${schemaPath} is not an object.`);
    }
    const objectContext = childContext(context, resolved);
    const childrenDefinitions = definition.type ? renderer.schema.types[definition.type].children : definition.children;
    if (definition.tag) {
        const { element } = await createComponent(renderer, definition, schemaPath);
        const registration = registerConditions(renderer, scope, definition, objectContext, element, parentCondition);
        const children = await renderChildren(renderer, childrenDefinitions, objectContext, `${schemaPath}/children`, scope, registration);
        appendRendered(element, children);
        return { nodes: [element], condition: registration };
    }
    const registration = registerConditions(renderer, scope, definition, objectContext, null, parentCondition);
    const children = await renderChildren(renderer, childrenDefinitions, objectContext, `${schemaPath}/children`, scope, registration);
    registration.targets.push(...children);
    return { nodes: children, condition: registration };
}

async function createArrayControl(renderer, scope, label, icon, schemaPath, listener) {
    const { element } = await createComponent(renderer, { tag: "x-button", props: { label, icon } }, schemaPath);
    element.classList.add("plain");
    addListener(scope, element, "click", listener);
    return element;
}

async function renderArray(renderer, definition, context, schemaPath, scope, parentCondition) {
    let resolved = resolvePath(context, definition.bind);
    if (resolved.value === undefined && Object.hasOwn(definition, "default")) {
        resolved = initializeBoundValue(context, definition.bind, definition.default);
    }
    if (!Array.isArray(resolved.value)) throw new Error(`Array binding '${pathLabel(resolved.path)}' at ${schemaPath} is not an array.`);
    const array = resolved.value;
    const arrayContext = childContext(context, resolved);
    const structural = document.createElement("div");
    structural.classList.add("x-schema-array");
    const items = document.createElement("div");
    items.classList.add("x-schema-array-items");
    const actions = document.createElement("div");
    actions.classList.add("x-schema-array-actions");
    structural.append(items, actions);
    let presentation = structural;
    if (definition.tag) {
        const created = await createComponent(renderer, definition, schemaPath);
        presentation = created.element;
        presentation.append(structural);
    }
    const registration = registerConditions(renderer, scope, definition, arrayContext, presentation, parentCondition);
    registration.controls = [];
    registration.controlAvailable = new Map();
    let itemsScope = null;
    const renderItems = async () => {
        if (itemsScope) disposeScope(renderer, itemsScope);
        items.replaceChildren();
        itemsScope = createScope(scope);
        for (let index = 0; index < array.length; index++) {
            const itemContext = createContext(context.rootValue, array[index], arrayContext, { target: array, key: index }, [...resolved.path, String(index)]);
            const rowClass = await ensureComponent(renderer, "x-datafields", `${schemaPath}/item/${index}`);
            const row = document.createElement("x-datafields");
            row.classList.add("x-schema-array-item");
            if (Object.hasOwn(rowClass.contract?.properties ?? {}, "remove")) row.remove = definition.allowRemove !== false && array.length > (definition.minItems ?? 0);
            if (Object.hasOwn(rowClass.contract?.properties ?? {}, "move")) row.move = definition.allowMove === true;
            const rendered = await renderElement(renderer, definition.item, itemContext, `${schemaPath}/item`, itemsScope, registration);
            appendRendered(row, rendered);
            addListener(itemsScope, row, "remove", async event => {
                if (event.target !== row) return;
                event.stopPropagation();
                if (definition.allowRemove === false || array.length <= (definition.minItems ?? 0)) return;
                const oldValue = array[index];
                array.splice(index, 1);
                await renderItems();
                refreshConditions(renderer);
                emitEditorChange(renderer, { path: [...resolved.path, String(index)], oldValue, newValue: undefined });
            });
            addListener(itemsScope, row, "move", async event => {
                if (event.target !== row) return;
                event.stopPropagation();
                const targetIndex = index + (event.detail?.direction === "up" ? -1 : 1);
                if (targetIndex < 0 || targetIndex >= array.length) return;
                const [moved] = array.splice(index, 1);
                array.splice(targetIndex, 0, moved);
                await renderItems();
                refreshConditions(renderer);
                emitEditorChange(renderer, { path: resolved.path, oldValue: index, newValue: targetIndex });
            });
            items.append(row);
        }
    };
    if (definition.allowAdd !== false) {
        const add = await createArrayControl(renderer, scope, "Add", "x-add", `${schemaPath}/add`, async event => {
            event.stopPropagation();
            if (definition.maxItems !== undefined && array.length >= definition.maxItems) return;
            const newValue = getNewArrayItemValue(renderer, definition.item, `${schemaPath}/item`);
            const index = array.length;
            array.push(newValue);
            await renderItems();
            refreshConditions(renderer);
            emitEditorChange(renderer, { path: [...resolved.path, String(index)], oldValue: undefined, newValue });
        });
        registration.controls.push(add);
        registration.controlAvailable.set(add, () => definition.maxItems === undefined || array.length < definition.maxItems);
        actions.append(add);
    }
    await renderItems();
    return { nodes: [presentation], condition: registration };
}

async function renderElement(renderer, definition, context, schemaPath, scope, parentCondition) {
    switch (definition.kind) {
        case "field": return renderField(renderer, definition, context, schemaPath, scope, parentCondition);
        case "object": return renderObject(renderer, definition, context, schemaPath, scope, parentCondition);
        case "array": return renderArray(renderer, definition, context, schemaPath, scope, parentCondition);
        case "container": return renderContainer(renderer, definition, context, schemaPath, scope, parentCondition);
        default: throw new Error(`Unsupported X-Schema element kind '${definition.kind}' at ${schemaPath}.`);
    }
}

async function renderChildren(renderer, definitions, context, schemaPath, scope, parentCondition) {
    const nodes = [];
    for (let index = 0; index < definitions.length; index++) {
        const rendered = await renderElement(renderer, definitions[index], context, `${schemaPath}/${index}`, scope, parentCondition);
        nodes.push(...rendered.nodes);
    }
    return nodes;
}

function disposeRenderedTree(renderer) {
    if (!renderer) return;
    disposeScope(renderer, renderer.scope);
    renderer.conditions.length = 0;
    renderer.mount.replaceChildren();
}

async function renderSchema(renderer) {
    const rootType = renderer.schema.types[renderer.schema.root];
    const nodes = await renderChildren(renderer, rootType.children, createContext(renderer.rootValue), `/types/${renderer.schema.root}/children`, renderer.scope, null);
    renderer.mount.replaceChildren(...nodes);
    refreshConditions(renderer);
}

function createRenderer({ schema, value, loader, host, mount }) {
    return { schema, rootValue: value, loader, host, mount, componentLoads: new Map(), conditions: [], scope: createScope() };
}

export const contract = {
    description: "Displays an editor for structured data described by an X-Schema document.",
    events: {
        change: {
            description: "Raised when a generated editor control changes the structured value.",
            detail: {
                path: {type: "string"},
                oldValue: {type: "any"},
                newValue: {type: "any"},
                value: {type: "object"}
            }
        }
    },
    properties: {
        src: {type:"string", default:null, attribute:true, state:true, description:"The source URL of the schema."},
        schema: {type:"object", default:null, attribute:false, state:true, description:"The X-Schema document that defines the editor."},
        value: {type:"object", default:null, attribute:false, state:true, description:"The structured data object being edited."}
    },
    methods: {}
};

export default {
    style: `
        :host {display:block;}
        .editor {display:block;}
        .x-schema-array-items {display:flex; flex-direction:column; gap:.5em;}
        .x-schema-array-actions {display:flex; justify-content:flex-end; margin-top:.5em;}
    `,
    template: `
        <x-notice type="error" x-if="state.validationResult && !state.validationResult.valid">
            Error in schema:
            <ul>
                <li x-for="error in state.validationResult.errors">
                    <b>{{error.instanceLocation || error.path}}:</b> {{error.error || error.message}} (keyword: {{error.keyword || 'semantic'}})
                </li>
            </ul>
        </x-notice>
        <x-notice type="error" x-elseif="state.renderingError" x-prop:message="state.renderingError"></x-notice>
        <div x-else class="editor"></div>
    `,
    state: {
        src: null,
        schema: null,
        value: null,
        validationResult: null,
        renderingError: null
    },
    controller({ events, loader, state, xSchemaValidator, host, commands }) {
        let renderer = null;
        let revision = 0;
        const dispose = () => {
            if (renderer) disposeRenderedTree(renderer);
            renderer = null;
        };
        return {
            load() {
                events.on(state, "change:value", "refresh");
                events.on(state, "change:schema", "refresh");
                events.on(state, "change:src", async () => {
                    state.schema = await loader.load(state.src);
                });
            },
            mount() {
                if (state.validationResult?.valid) commands.enqueue("renderEditor", {revision});
            },
            unmount() {
                dispose();
            },
            unload() {
                dispose();
            },
            async refresh() {
                const currentRevision = ++revision;
                dispose();
                state.renderingError = null;
                if (!state.schema || state.value === null || state.value === undefined) {
                    state.validationResult = null;
                    return;
                }
                state.validationResult = await xSchemaValidator.validate(state.schema);
                if (currentRevision !== revision || !state.validationResult.valid) return;
                commands.enqueue("renderEditor", {revision: currentRevision});
            },
            async renderEditor({revision: requestedRevision}) {
                if (requestedRevision !== revision || !state.validationResult?.valid) return;
                const mount = host.shadowRoot.querySelector(".editor");
                if (!mount) return;
                dispose();
                renderer = createRenderer({ schema: state.schema, value: state.value, loader, host, mount });
                try {
                    await renderSchema(renderer);
                } catch (error) {
                    dispose();
                    state.renderingError = error.message;
                    console.error("Unable to render X-Schema editor:", error);
                }
            }
        };
    }
};
