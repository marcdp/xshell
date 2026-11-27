function flattenMenu(items, result = []) {
    // Keep the same depth-first order as the renderer's absolute index.
    if (!Array.isArray(items)) return result;
    for (const item of items) {
        result.push(item);
        flattenMenu(item?.children, result);
    }
    return result;
}

export function getMenuShortcutHints(items) {
    // Keep the visible hint scalar even when the menu item has several bindings.
    return flattenMenu(items).map(item => {
        const shortcut = item?.shortcut;
        const first = Array.isArray(shortcut) ? shortcut[0] : shortcut;
        return typeof first === "string" ? first : null;
    });
}

export function bindMenuPresenter(root, items, services) {
    // Match the renderer's depth-first index while keeping effective item identity in the presenter.
    const shortcuts = services?.has?.("menuShortcuts") ? services.resolve("menuShortcuts") : null;
    const controls = shortcuts && root?.querySelectorAll("[data-menu-index]");
    if (!controls?.length) return () => {};
    const itemsByIndex = flattenMenu(items);
    const cleanup = [];
    for (const control of controls) {
        const item = itemsByIndex[control.dataset.menuIndex];
        if (!item?.shortcut) continue;

        // Let menu items own submenu toggling and activate standalone links and buttons by click.
        cleanup.push(shortcuts.registerPresenter(item, control, () => {
            if (control.localName === "x-menuitem") return control.activate?.() ?? false;
            const trigger = control.shadowRoot?.querySelector("a, button");
            if (!trigger || control.disabled) return false;
            trigger.click();
            return true;
        }));
    }
    return () => cleanup.forEach(release => release());
}
