import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import Areas from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/areas.js';
import Navigation from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/navigation.js';
import Menus from "../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/menus.js";
import JsonValidator from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/services/json-validator.js';
import componentSchema from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/component.schema.json' with { type: 'json' };
import contractSchema from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/schemas/contract.schema.json' with { type: 'json' };
import { normalizeManifest } from './helpers/manifest-composition.mjs';

const root = fileURLToPath(new URL('../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/', import.meta.url));
const config = JSON.parse(readFileSync(path.join(root, 'manifest.jsonc'), 'utf8').replace(/^\/\/[^\n]*\n/, ''));

function assertValidComponent(implementation) {
    // Validate the complete definition with its inline contract.
    const definition = { ...implementation, controller: {} };
    const result = new JsonValidator().validate(definition, componentSchema, { './contract.schema.json': contractSchema });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
}

test('x-demo is a separate root with repository dependencies', () => {
    assert.deepEqual(Object.keys(config.modules), ['x-demo']);
    assert.equal(config.xshell.services.areas.options.default, 'cookbook');
    for (const [id, reference] of Object.entries(config.modules['x-demo'].dependencies)) {
        assert.equal(reference, `module:${id}:latest`);
        assert.ok(existsSync(path.resolve(root, '..', id, 'manifest.jsonc')), id);
    }
});

const pageFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? pageFiles(absolute) :
            [path.relative(root, absolute).replaceAll('\\', '/').replace(/\.html$/, '.js')];
});

test('cookbook navigation derives ordered Pages from the file inventory', () => {
    const { definitions } = config.xshell.services.menus.options;
    assert.deepEqual(definitions.cookbook, { sources: [{ source: '/pages' }] });
    const files = pageFiles(path.join(root, 'pages'));
    const runtimeConfig = {
            xshell: { assets: { basePath: '/_assets' } },
            modules: { 'x-demo': { assets: { path: '/_assets/x-demo' }, label: 'XShell Cookbook', files: files.map(file => ({ path: `/_assets/x-demo/${file.replace(/\.js$/, file.includes('html-page') ? '.html' : '.js')}` })) } }
    };
    const bus = new EventTarget();
    const areas = new Areas({ config: runtimeConfig, bus }, { default: 'cookbook', definitions: {
        cookbook: config.xshell.services.areas.options.definitions.cookbook
    } });
    const menus = new Menus({ areas, bus, config: runtimeConfig }, { definitions: {
        'cookbook': { sources: [{ source: '/_assets/x-demo/pages' }] }
    } });
    menus.init();
    areas.init({ menus });
    const { name, items: menu } = menus.getMenu('navigation');
    assert.equal(name, 'navigation');
    assert.equal(areas.getArea('cookbook').home, '/cookbook/');
    assert.deepEqual(menu[0].children.map(item => item.label),
        ['Components', 'Pages', 'Navigation', 'Dialogs', 'Filesystem', 'Stores', 'Modules', 'Templates', 'Ai', 'Advanced']);
    assert.deepEqual(menu[0].children[0].children.map(item => item.label),
        ['Anchors', 'Buttons', 'Indicators', 'Forms', 'Data Display', 'Listviews', 'Treeviews', 'Layout', 'Editors', 'Composition', 'Contract', 'Lifecycle', 'Schema', 'Wizard']);
    assert.deepEqual(menu[0].children[2].children.map(item => item.label),
        ['Basic', 'Areas', 'Stack', 'Embedded', 'Resolution', 'Url Rewriting']);
    const visited = new Set();
    const walk = items => {
        for (const item of items) {
            assert.doesNotMatch(item.label, /^\d+-/);
            assert.ok(item.href?.startsWith('/cookbook/_assets/x-demo/pages/'), item.href);
            const relative = item.href.slice('/cookbook/_assets/x-demo/'.length);
            assert.ok(files.includes(relative), relative);
            visited.add(relative);
            walk(item.children || []);
        }
    };
    walk(menu);
    assert.deepEqual([...visited].sort(), files.sort());
    assert.equal(menu[0].children[1].children[1].href, '/cookbook/_assets/x-demo/pages/02-pages/02-html-page.js');
});

test('Cookbook public route resolves against its normalized Area definition', () => {
    const assetsPath = '/_assets/x-demo/0.9.0.dev';
    const manifest = normalizeManifest(config, { assetsPath });
    const services = manifest.xshell.services;
    const runtimeConfig = {
        app: { baseUrl: 'https://example.test/', basePath: '' },
        xshell: { assets: { basePath: '/_assets' }, services },
        modules: { 'x-demo': { assets: { path: assetsPath } } }
    };
    const bus = new EventTarget();
    const areas = new Areas({ config: runtimeConfig, bus }, services.areas.options);
    const logger = { trace() {} };
    const navigation = new Navigation({ config: runtimeConfig, areas, bus, logger }, { mode: 'path' }, { container: {} });
    const target = assetsPath + '/pages/02-pages/03-parameters.js';
    assert.deepEqual(navigation.resolveRoute('/cookbook/hello/Marc'), {
        areaId: 'cookbook', areaPrefix: '/cookbook', moduleId: 'x-demo', route: '/hello/{name}',
        target, params: { name: 'Marc' }, href: '/cookbook' + target + '?name=Marc'
    });
});

test('cookbook Page links resolve after renaming', () => {
    for (const file of pageFiles(path.join(root, 'pages'))) {
        const sourcePath = path.join(root, file.replace(/02-html-page\.js$/, '02-html-page.html'));
        const source = readFileSync(sourcePath, 'utf8');
        for (const [, href] of source.matchAll(/<x-(?:anchor|listview-item)\b[^>]*\shref="([^"]+)"/g)) {
            if (href.startsWith('/')) continue;
            const destination = new URL(href.replaceAll('&amp;', '&'), `https://example.test/${file}`).pathname.slice(1);
            assert.ok(existsSync(path.join(root, destination)) ||
                existsSync(path.join(root, destination.replace(/\.js$/, '.html'))), `${file} -> ${href}`);
        }
    }
    assert.ok(existsSync(path.join(root, 'pages/04-dialogs/custom-dialog.js')));
    assert.match(readFileSync(path.join(root, 'pages/04-dialogs/05-custom.js'), 'utf8'),
        /page:x-demo:\/pages\/04-dialogs\/custom-dialog\.js/);
});

test('the counter keeps its public contract separate from private state', async () => {
    const { default: implementation } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/components/x-demo-counter.js', import.meta.url));
    assertValidComponent(implementation);
    const { contract } = implementation;
    assert.deepEqual(Object.keys(contract.properties), ['label']);
    assert.deepEqual(Object.keys(contract.methods), ['reset']);
    assert.deepEqual(Object.keys(contract.slots), ['hint']);
    assert.deepEqual(Object.keys(implementation.state), ['count']);
});

test('the cookbook module controller exposes its startup state', async () => {
    const { default: ModuleController } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/module.js', import.meta.url));
    const controller = new ModuleController({ config, moduleConfig: config.modules['x-demo'] });
    assert.equal(controller.started, false);
    controller.start();
    assert.equal(controller.started, true);
    assert.equal(controller.label, 'XShell Cookbook');
});

test('the cookbook module controller summarizes its effective Page inventory', async () => {
    const { default: ModuleController } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/module.js', import.meta.url));
    const controller = new ModuleController({ config: { xshell: { services: { menus: { options: { definitions: {
        'cookbook': { sources: [{ source: '/_assets/x-demo/pages' }] }
    } } } } } }, moduleConfig: {
        id: 'x-demo', label: 'XShell Cookbook',
        assets: { path: '/_assets/x-demo' }, files: [
            { path: '/_assets/x-demo/pages/index.js' },
            { path: '/_assets/x-demo/pages/01-components/01-buttons.js' },
            { path: '/_assets/x-demo/datasets/statuses.json' }
        ]
    } });
    controller.start();
    assert.deepEqual(controller.getCookbookSummary(), {
        id: 'x-demo', label: 'XShell Cookbook', menuSource: '/_assets/x-demo/pages',
        pageCount: 2, started: true
    });
});

test('the Module Controller Page reads its injected controller', async () => {
    const { default: example } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/06-modules/04-controller.js', import.meta.url));
    const summary = {
        id: 'x-demo', label: 'XShell Cookbook', menuSource: '/_assets/x-demo/pages',
        pageCount: 42, started: true
    };
    const state = {};
    const controller = example.controller({
        moduleController: { getCookbookSummary() { return summary; } }, state
    });
    controller.load();
    assert.deepEqual(state, summary);
});

test('path resolution example follows the effective Area menu in both directions', async () => {
    const { default: example } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/03-navigation/05-resolution.js', import.meta.url));
    const href = '/cookbook/_assets/x-demo/pages/03-navigation/05-resolution.js';
    const item = { path: '/cookbook/navigation/resolution', href };
    const state = {};
    const controller = example.controller({
        areas: {
            resolveAreaId(src) { assert.equal(src, href); return 'cookbook'; }
        },
        menus: {
            resolveHref(src, areaId) { assert.equal(areaId, 'cookbook'); assert.equal(src, href); return item; },
            resolvePath(path) { assert.equal(path, item.path); return item; }
        },
        page: { src: href }, state
    });
    controller.load();
    assert.equal(state.path, item.path);
    assert.equal(state.href, href);
    assert.equal(state.resolved, href);
});

test('resolver example inspects without loading and reports a concrete dataset', async () => {
    const { default: example } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/05-resolver-and-loader.js', import.meta.url));
    const state = {};
    let loads = 0;
    const controller = example.controller({
        resolver: { resolve(resource) { return { definition: { resource: 'dataset:x-demo:{name}', loader: 'dataset-url' }, url: `https://example.test/${resource}` }; } },
        loader: { async load(resource) { loads++; assert.equal(resource, 'dataset:x-demo:statuses'); return { tables: [{ rows: [{ code: 'A' }] }] }; } },
        state
    });
    controller.inspectDataset();
    assert.equal(loads, 0);
    assert.equal(state.loaderName, 'dataset-url');
    await controller.loadSelected();
    assert.equal(loads, 1);
    assert.equal(state.value, '1 table(s), 1 row(s)');
    assert.equal(state.status, 'Loaded');
});

test('component lifecycle probe reports supported hooks in order', async () => {
    const { default: implementation } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/components/x-demo-lifecycle.js', import.meta.url));
    assertValidComponent(implementation);
    const stages = [];
    const controller = implementation.controller({ bus: {
        emit(name, detail) { assert.equal(name, 'x-demo:component-lifecycle'); stages.push(detail.stage); }
    } });
    for (const hook of ['load', 'mount', 'unmount', 'unload']) controller[hook]();
    assert.deepEqual(stages, ['load', 'mount', 'unmount', 'unload']);
});

test('engine example distinguishes effective Page metadata from module defaults', async () => {
    const { default: example } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/03-engines.js', import.meta.url));
    const state = { count: 0 };
    const controller = example.controller({
        config: { modules: { 'x-demo': { defaults: {
            page: { renderEngine: 'x', stateEngine: 'proxy' },
            component: { renderEngine: 'x', stateEngine: 'proxy' }
        } } } },
        dependencies: { clientPage: { implementation: { meta: { renderEngine: 'x-client', stateEngine: 'proxy' } } } },
        implementation: { meta: { renderEngine: 'x', stateEngine: 'proxy' } }, state
    });
    controller.load();
    controller.increase();
    assert.deepEqual([state.defaultPageRender, state.defaultPageState, state.defaultComponentRender,
        state.currentRender, state.clientRender, state.clientState, state.count],
        ['x', 'proxy', 'x', 'x', 'x-client', 'proxy', 1]);
});
