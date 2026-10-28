
export default {
    meta: {
        title: "Treeviews",
        description: "Demonstrates hierarchical items, expansion, selection, and keyboard navigation."
    },

    template: `
        <p>The <code>x-treeview</code> Component displays hierarchical data. Each <code>x-treeview-item</code> can contain nested items that expand or collapse.</p>

        <h2>Basic treeview</h2>
        <p>Click an item to select it. Use the arrow icon or double-click a parent item to expand or collapse its children.</p>
        <x-treeview x-on:select="onSelect" x-on:toggle="onToggle">
            <x-treeview-item icon="x-folder" label="Documents" path="/documents" expanded>
                <x-treeview-item icon="x-folder" label="Projects" path="/documents/projects" expanded>
                    <x-treeview-item icon="x-file" label="Project.txt" path="/documents/projects/project.txt"></x-treeview-item>
                    <x-treeview-item icon="x-file" label="Notes.txt" path="/documents/projects/notes.txt"></x-treeview-item>
                </x-treeview-item>
                <x-treeview-item icon="x-file" label="Report.pdf" path="/documents/report.pdf"></x-treeview-item>
            </x-treeview-item>
            <x-treeview-item icon="x-folder" label="Images" path="/images">
                <x-treeview-item icon="x-image" label="Photo.png" path="/images/photo.png"></x-treeview-item>
                <x-treeview-item icon="x-image" label="Logo.png" path="/images/logo.png"></x-treeview-item>
            </x-treeview-item>
            <x-treeview-item icon="x-file" label="Readme.txt" path="/readme.txt"></x-treeview-item>
        </x-treeview>
        <p>Selected: <strong>{{ state.selected }}</strong></p>
        <p>Last toggled: {{ state.toggled }}</p>
        <pre x-pre><code>&lt;x-treeview&gt;
    &lt;x-treeview-item icon="x-folder" label="Documents" path="/documents" expanded&gt;
        &lt;x-treeview-item icon="x-file" label="Report.pdf" path="/documents/report.pdf"&gt;&lt;/x-treeview-item&gt;
    &lt;/x-treeview-item&gt;
&lt;/x-treeview&gt;</code></pre>

        <h2>Multiple selection</h2>
        <p>Set <code>multiple</code> to allow several items to be selected. Click an item again to deselect it.</p>
        <x-treeview multiple x-on:select="onMultiSelect">
            <x-treeview-item icon="x-folder" label="Sources" path="/sources" expanded>
                <x-treeview-item icon="x-file" label="app.js" path="/sources/app.js"></x-treeview-item>
                <x-treeview-item icon="x-file" label="utils.js" path="/sources/utils.js"></x-treeview-item>
                <x-treeview-item icon="x-file" label="config.json" path="/sources/config.json"></x-treeview-item>
            </x-treeview-item>
            <x-treeview-item icon="x-file" label="package.json" path="/package.json"></x-treeview-item>
        </x-treeview>
        <p>Selected items: {{ state.multipleSelection }}</p>
        <pre x-pre><code>&lt;x-treeview multiple&gt;
    &lt;x-treeview-item label="First" path="/first"&gt;&lt;/x-treeview-item&gt;
    &lt;x-treeview-item label="Second" path="/second"&gt;&lt;/x-treeview-item&gt;
&lt;/x-treeview&gt;</code></pre>

        <h2>Keyboard navigation</h2>
        <p>Focus the treeview and use the keyboard to navigate between items.</p>
        <ul>
            <li><strong>Up / Down:</strong> Move between visible items.</li>
            <li><strong>Left:</strong> Collapse the selected item or move to its parent.</li>
            <li><strong>Right:</strong> Expand the selected item or move to its first child.</li>
            <li><strong>Enter:</strong> Toggle expansion and raise a select event.</li>
            <li><strong>Space:</strong> Toggle expansion.</li>
            <li><strong>Page Up / Page Down:</strong> Move through larger groups of items.</li>
        </ul>

        <h2>Events</h2>
        <p>The treeview raises <code>select</code> and <code>toggle</code> events. Their event details include the affected item's path.</p>
        <pre x-pre><code>&lt;x-treeview x-on:select="onSelect" x-on:toggle="onToggle"&gt;
    ...
&lt;/x-treeview&gt;</code></pre>
        <pre x-pre><code>controller({ state }) {
    return {
        onSelect({ event }) { state.selected = event.detail.path; },
        onToggle({ event }) { state.toggled = event.detail.path; }
    };
}</code></pre>
    `,

    state: {
        selected: "None",
        toggled: "None",
        multipleSelection: "None"
    },

    controller({ state }) {
        return {
            onSelect({ event }) { state.selected = event.detail.path || "None"; },
            onToggle({ event }) { state.toggled = event.detail.path || "None"; },
            onMultiSelect({ event }) {
                const items = event.currentTarget.querySelectorAll("x-treeview-item[selected]");
                state.multipleSelection = [...items].map(item => item.label).join(", ") || "None";
            }
        };
    }
};
