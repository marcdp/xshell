
export default {
    meta: {
        title: "Listviews",
        description: "Demonstrates list, details, icons, and tiles views, columns, selection, and item activation."
    },

    template: `
        <p>The <code>x-listview</code> Component displays a collection in several layouts. It supports selectable items, categories, details columns, and navigation.</p>

        <h2>Views</h2>
        <p>Use the built-in view selector to switch between <code>list</code>, <code>details</code>, <code>icons</code>, and <code>tiles</code>.</p>
        <x-listview view="details" views="list,details,icons,tiles" x-on:select="onSelect" x-on:activate="onActivate">
            <x-listview-head>
                <x-listview-column label="Name" width="minmax(12em, 1fr)"></x-listview-column>
                <x-listview-column label="Type" width="8em"></x-listview-column>
                <x-listview-column label="Size" width="6em"></x-listview-column>
            </x-listview-head>
            <x-listview-body>
                <x-listview-item icon="x-folder" label="Documents" description="Project files" category="Folders" path="/documents">
                    <span>Folder</span><span>—</span>
                </x-listview-item>
                <x-listview-item icon="x-folder" label="Images" description="Image collection" category="Folders" path="/images">
                    <span>Folder</span><span>—</span>
                </x-listview-item>
                <x-listview-item icon="x-file" label="Notes.txt" description="Plain text" category="Files" path="/notes.txt">
                    <span>Text</span><x-file-size value="2048"></x-file-size>
                </x-listview-item>
                <x-listview-item icon="x-file" label="Report.pdf" description="Monthly report" category="Files" path="/report.pdf">
                    <span>PDF</span><x-file-size value="5242880"></x-file-size>
                </x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png" description="Sample image" category="Files" path="/photo.png">
                    <span>Image</span><x-file-size value="1048576"></x-file-size>
                </x-listview-item>
            </x-listview-body>
        </x-listview>
        <p>Selected item: <strong>{{ state.selected }}</strong></p>
        <p>Activated item: <strong>{{ state.activated }}</strong></p>
        <pre x-pre><code>&lt;x-listview view="details" views="list,details,icons,tiles"&gt;
    &lt;x-listview-head&gt;
        &lt;x-listview-column label="Name" width="minmax(12em, 1fr)"&gt;&lt;/x-listview-column&gt;
        &lt;x-listview-column label="Type" width="8em"&gt;&lt;/x-listview-column&gt;
    &lt;/x-listview-head&gt;
    &lt;x-listview-body&gt;
        &lt;x-listview-item icon="x-file" label="Notes.txt" path="/notes.txt"&gt;
            &lt;span&gt;Text&lt;/span&gt;
        &lt;/x-listview-item&gt;
    &lt;/x-listview-body&gt;
&lt;/x-listview&gt;</code></pre>

        <h2>Multiple selection</h2>
        <p>Set <code>multiple</code> to allow selecting more than one item. Click items to toggle their selection.</p>
        <x-listview view="list" multiple x-on:select="onMultiSelect">
            <x-listview-body>
                <x-listview-item icon="x-file" label="First.txt" path="/first.txt"></x-listview-item>
                <x-listview-item icon="x-file" label="Second.txt" path="/second.txt"></x-listview-item>
                <x-listview-item icon="x-file" label="Third.txt" path="/third.txt"></x-listview-item>
            </x-listview-body>
        </x-listview>
        <p>Selection: {{ state.multipleSelection }}</p>
        <pre x-pre><code>&lt;x-listview view="list" multiple&gt;
    &lt;x-listview-body&gt;
        &lt;x-listview-item label="First.txt" path="/first.txt"&gt;&lt;/x-listview-item&gt;
        &lt;x-listview-item label="Second.txt" path="/second.txt"&gt;&lt;/x-listview-item&gt;
    &lt;/x-listview-body&gt;
&lt;/x-listview&gt;</code></pre>

        <h2>Navigation</h2>
        <p>Set <code>href</code> on an item to make it a navigable link. The listview uses <code>x-anchor</code> internally for navigation.</p>
        <x-listview view="list">
            <x-listview-body>
                <x-listview-item icon="x-file" label="Buttons" description="Button demonstrations" href="01-buttons.js"></x-listview-item>
                <x-listview-item icon="x-file" label="Indicators" description="Status and progress" href="02-indicators.js"></x-listview-item>
                <x-listview-item icon="x-file" label="Form Inputs" description="Datafield types" href="03-forms.js"></x-listview-item>
            </x-listview-body>
        </x-listview>
        <pre x-pre><code>&lt;x-listview-item icon="x-file" label="Buttons" href="01-buttons.js"&gt;&lt;/x-listview-item&gt;</code></pre>
    `,

    state: {
        selected: "None",
        activated: "None",
        multipleSelection: "None"
    },

    controller({ state }) {
        return {
            onSelect({ event }) {
                const item = event.detail?.item || event.target;
                state.selected = item?.label || item?.getAttribute?.("label") || "None";
            },
            onActivate({ event }) {
                const item = event.detail?.item || event.target;
                state.activated = item?.label || item?.getAttribute?.("label") || "None";
            },
            onMultiSelect({ event }) {
                const list = event.currentTarget;
                const selected = [...list.querySelectorAll("x-listview-item[selected]")];
                state.multipleSelection = selected.map(item => item.label).join(", ") || "None";
            }
        };
    }
};
