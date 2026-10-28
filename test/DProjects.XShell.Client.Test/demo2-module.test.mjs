import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import Areas from '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/areas.js';

const root = fileURLToPath(new URL('../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo2/', import.meta.url));
const config = JSON.parse(readFileSync(path.join(root, 'module.jsonc'), 'utf8').replace(/^\/\/[^\n]*\n/, ''));

test('x-demo2 is a separate root with resolvable module references', () => {
    assert.deepEqual(Object.keys(config.modules).filter(id => !config.modules[id].configUrl), ['x-demo2']);
    assert.equal(config.xshell.areas.default, 'cookbook');
    assert.deepEqual(config.xshell.areas.definitions.cookbook.modules, ['x-demo2']);
    for (const [id, module] of Object.entries(config.modules)) {
        if (id === 'x-demo2') continue;
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
    assert.equal(config.modules['x-demo2'].menus.navigation, '/pages');
    const files = pageFiles(path.join(root, 'pages'));
    const module = { id: 'x-demo2', config: { menus: { navigation: '/_assets/x-demo2/pages' } } };
    const areas = new Areas({
        config: {
            xshell: { assets: { basePath: '/_assets' }, areas: { default: 'cookbook', global: [], definitions: {
                cookbook: { prefix: '/cookbook', modules: ['x-demo2'] }
            } } },
            modules: { 'x-demo2': { label: 'XShell Cookbook', files: files.map(file => ({ path: `/_assets/x-demo2/${file.replace(/\.js$/, file.includes('html-page') ? '.html' : '.js')}` })) } }
        },
        bus: { addEventListener() {} }
    });
    areas.init({ modules: { getModuleById() { return module; } } });
    const menu = areas.getMenu('navigation');
    assert.equal(areas.getArea('cookbook').home, '/cookbook/');
    assert.deepEqual(menu[0].children.map(item => item.label),
        ['Components', 'Pages', 'Navigation', 'Dialogs', 'Filesystem', 'Modules', 'Templates', 'Ai', 'Advanced']);
    assert.deepEqual(menu[0].children[0].children.map(item => item.label),
        ['Buttons', 'Indicators', 'Forms', 'Data Display', 'Lists', 'Layout', 'Editors', 'Composition', 'Contract']);
    const visited = new Set();
    const walk = items => {
        for (const item of items) {
            assert.doesNotMatch(item.label, /^\d+-/);
            assert.ok(item.href?.startsWith('/cookbook/_assets/x-demo2/pages/'), item.href);
            const relative = item.href.slice('/cookbook/_assets/x-demo2/'.length);
            assert.ok(files.includes(relative), relative);
            visited.add(relative);
            walk(item.children || []);
        }
    };
    walk(menu);
    assert.deepEqual([...visited].sort(), files.sort());
    assert.ok(![...visited].some(file => file.includes('custom-dialog')));
    assert.equal(menu[0].children[1].children[1].href, '/cookbook/_assets/x-demo2/pages/02-pages/02-html-page.js');
    assert.equal(config.modules['x-demo2'].routes['/hello/{name}'], '/pages/02-pages/03-parameters.js');
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
        /page:x-demo2:\/dialog-pages\/custom-dialog\.js/);
});

test('the counter keeps its public contract separate from private state', async () => {
    const { contract, default: implementation } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo2/components/x-demo2-counter.js', import.meta.url));
    const { default: validateContract } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/component.contract.js', import.meta.url));
    const { default: validateComponent } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/xshell/validation/component.js', import.meta.url));
    await validateContract('x-demo2-counter', contract);
    await validateComponent('x-demo2-counter', implementation);
    assert.deepEqual(Object.keys(contract.properties), ['label']);
    assert.deepEqual(Object.keys(contract.methods), ['reset']);
    assert.deepEqual(Object.keys(contract.slots), ['hint']);
    assert.deepEqual(Object.keys(implementation.state), ['count']);
});

test('the cookbook module controller exposes its startup state', async () => {
    const { default: ModuleController } = await import(new URL(
        '../../src/DProjects.XShell/Resources/DProjects.XShell/x-demo2/module.js', import.meta.url));
    const controller = new ModuleController({ moduleConfig: config.modules['x-demo2'] });
    assert.equal(controller.started, false);
    controller.start();
    assert.equal(controller.started, true);
    assert.equal(controller.label, 'XShell Cookbook');
});
