import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import Areas from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/areas.js';

const root = fileURLToPath(new URL('../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/', import.meta.url));
const config = JSON.parse(readFileSync(path.join(root, 'module.jsonc'), 'utf8').replace(/^\/\/[^\n]*\n/, ''));

test('x-demo is a separate root with resolvable module references', () => {
    assert.deepEqual(Object.keys(config.modules).filter(id => !config.modules[id].configUrl), ['x-demo']);
    assert.equal(config.xshell.areas.default, 'cookbook');
    assert.deepEqual(config.xshell.areas.definitions.cookbook.modules, ['x-demo']);
    for (const [id, module] of Object.entries(config.modules)) {
        if (id === 'x-demo') continue;
        assert.match(module.configUrl, /^url:\.\.\//);
        assert.ok(existsSync(path.resolve(root, module.configUrl.slice(4))), id);
    }
});

const pageFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? pageFiles(absolute) :
            [path.relative(root, absolute).replaceAll('\\', '/').replace(/\.html$/, '.js')];
});

test('cookbook navigation derives ordered Pages from the file inventory', () => {
    assert.equal(config.modules['x-demo'].menus.navigation, '/pages');
    const files = pageFiles(path.join(root, 'pages'));
    const module = { id: 'x-demo', config: { menus: { navigation: '/_assets/x-demo/pages' } } };
    const areas = new Areas({
        config: {
            xshell: { assets: { basePath: '/_assets' }, areas: { default: 'cookbook', global: [], definitions: {
                cookbook: { prefix: '/cookbook', modules: ['x-demo'] }
            } } },
            modules: { 'x-demo': { label: 'XShell Cookbook', files: files.map(file => ({ path: `/_assets/x-demo/${file.replace(/\.js$/, file.includes('html-page') ? '.html' : '.js')}` })) } }
        },
        bus: { addEventListener() {} }
    });
    areas.init({ modules: { getModuleById() { return module; } } });
    const menu = areas.getMenu('navigation');
    assert.equal(areas.getArea('cookbook').home, '/cookbook/');
    assert.deepEqual(menu[0].children.map(item => item.label),
        ['Components', 'Pages', 'Navigation', 'Dialogs', 'Filesystem', 'Modules', 'Templates', 'Ai', 'Advanced']);
    assert.deepEqual(menu[0].children[0].children.map(item => item.label),
        ['Buttons', 'Indicators', 'Forms', 'Data Display', 'Lists', 'Layout', 'Editors', 'Composition', 'Contract', 'Lifecycle']);
    assert.deepEqual(menu[0].children[2].children.map(item => item.label),
        ['Basic', 'Areas', 'Stack', 'Embedded', 'Resolution']);
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
    assert.ok(![...visited].some(file => file.includes('custom-dialog')));
    assert.equal(menu[0].children[1].children[1].href, '/cookbook/_assets/x-demo/pages/02-pages/02-html-page.js');
    assert.equal(config.modules['x-demo'].routes['/hello/{name}'], '/pages/02-pages/03-parameters.js');
});

test('cookbook Page links resolve after renaming', () => {
    for (const file of pageFiles(path.join(root, 'pages'))) {
        const sourcePath = path.join(root, file.replace(/02-html-page\.js$/, '02-html-page.html'));
        const source = readFileSync(sourcePath, 'utf8');
        for (const [, href] of source.matchAll(/<x-anchor href="([^"]+)"/g)) {
            if (href.startsWith('/')) continue;
            const destination = new URL(href.replaceAll('&amp;', '&'), `https://example.test/${file}`).pathname.slice(1);
            assert.ok(existsSync(path.join(root, destination)) ||
                existsSync(path.join(root, destination.replace(/\.js$/, '.html'))), `${file} -> ${href}`);
        }
    }
    assert.ok(existsSync(path.join(root, 'dialog-pages/custom-dialog.js')));
    assert.match(readFileSync(path.join(root, 'pages/04-dialogs/05-custom.js'), 'utf8'),
        /page:x-demo:\/dialog-pages\/custom-dialog\.js/);
});

test('the counter keeps its public contract separate from private state', async () => {
    const { contract, default: implementation } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/components/x-demo-counter.js', import.meta.url));
    const { default: validateContract } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/component.contract.js', import.meta.url));
    const { default: validateComponent } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/component.js', import.meta.url));
    await validateContract('x-demo-counter', contract);
    await validateComponent('x-demo-counter', implementation);
    assert.deepEqual(Object.keys(contract.properties), ['label']);
    assert.deepEqual(Object.keys(contract.methods), ['reset']);
    assert.deepEqual(Object.keys(contract.slots), ['hint']);
    assert.deepEqual(Object.keys(implementation.state), ['count']);
});

test('the cookbook module controller exposes its startup state', async () => {
    const { default: ModuleController } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/module.js', import.meta.url));
    const controller = new ModuleController({ moduleConfig: config.modules['x-demo'] });
    assert.equal(controller.started, false);
    controller.start();
    assert.equal(controller.started, true);
    assert.equal(controller.label, 'XShell Cookbook');
});

test('the cookbook module controller summarizes its effective Page inventory', async () => {
    const { default: ModuleController } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/module.js', import.meta.url));
    const controller = new ModuleController({ moduleConfig: {
        id: 'x-demo', label: 'XShell Cookbook', menus: { navigation: '/_assets/x-demo/pages' },
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

test('path resolution example follows the effective Area menu in both directions', async () => {
    const { default: example } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/03-navigation/05-resolution.js', import.meta.url));
    const href = '/cookbook/_assets/x-demo/pages/03-navigation/05-resolution.js';
    const item = { path: '/cookbook/navigation/resolution', href };
    const state = {};
    const controller = example.controller({
        areas: {
            resolveAreaId(src) { assert.equal(src, href); return 'cookbook'; },
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
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/pages/90-advanced/05-loading.js', import.meta.url));
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
    assert.equal(state.value, '1 dataset rows');
    assert.equal(state.status, 'Loaded');
});

test('component lifecycle probe reports supported hooks in order', async () => {
    const { contract, default: implementation } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo/components/x-demo-lifecycle.js', import.meta.url));
    const { default: validateContract } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/component.contract.js', import.meta.url));
    const { default: validateComponent } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/component.js', import.meta.url));
    await validateContract('x-demo-lifecycle', contract);
    await validateComponent('x-demo-lifecycle', implementation);
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
        config: { modules: { 'x-demo': { defaults: { page: { renderEngine: 'x', stateEngine: 'proxy' } } } } },
        dependencies: { clientPage: { implementation: { meta: { renderEngine: 'x-client', stateEngine: 'proxy' } } } },
        implementation: { meta: { renderEngine: 'x', stateEngine: 'proxy' } }, state
    });
    controller.load();
    controller.increase();
    assert.deepEqual([state.defaultRender, state.currentRender, state.clientRender, state.clientState, state.count],
        ['x', 'x', 'x-client', 'proxy', 1]);
});
