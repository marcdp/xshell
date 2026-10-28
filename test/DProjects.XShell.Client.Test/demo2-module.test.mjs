import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

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

test('every cookbook Page is reachable from its explicit menu', () => {
    const visited = new Set();
    const walk = items => {
        for (const item of items) {
            assert.ok(item.label, 'menu labels are explicit');
            assert.ok(!item.path?.startsWith('/'), 'friendly menu paths stay separate from module URLs');
            if (item.href) {
                assert.ok(item.href.startsWith('/pages/'), item.href);
                const pagePath = item.href.slice(1);
                assert.ok(existsSync(path.join(root, pagePath)) ||
                    (pagePath.endsWith('.js') && existsSync(path.join(root, pagePath.replace(/\.js$/, '.html')))), pagePath);
                visited.add(pagePath);
            }
            walk(item.children || []);
        }
    };
    walk(config.modules['x-demo2'].menus.navigation);
    assert.ok(visited.size > 30);
    assert.ok(visited.has('pages/index.js'));
    assert.ok(visited.has('pages/components/contract.js'));
    assert.ok(visited.has('pages/ai/chat.js'));
    const pageFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const absolute = path.join(directory, entry.name);
        return entry.isDirectory() ? pageFiles(absolute) :
            [path.relative(root, absolute).replaceAll('\\', '/').replace(/\.html$/, '.js')];
    });
    assert.deepEqual([...visited].sort(), pageFiles(path.join(root, 'pages')).sort());
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
