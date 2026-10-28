
export default {
    meta: {
        title: "Composition",
        description: "Demonstrates default and named slots, nested Components, and interactive composition."
    },

    template: `
        <p>Composition combines reusable Components without modifying their implementations. Slots allow a parent Component to determine where caller-provided content appears.</p>

        <h2>Default slots</h2>
        <p>The default slot displays content placed directly inside a Component.</p>
        <x-card>
            <h3>Project summary</h3>
            <p>This content is rendered in the card's default slot.</p>
            <x-badge value="Active"></x-badge>
        </x-card>
        <pre x-pre><code>&lt;x-card&gt;
    &lt;h3&gt;Project summary&lt;/h3&gt;
    &lt;p&gt;Content in the default slot.&lt;/p&gt;
&lt;/x-card&gt;</code></pre>

        <h2>Named slots</h2>
        <p>Use the <code>slot</code> attribute to place content in a specific region of a Component.</p>
        <x-card>
            <h3 slot="header">User profile</h3>
            <p><strong>Name:</strong> Ada Developer</p>
            <p><strong>Role:</strong> Administrator</p>
            <div slot="footer">
                <x-button label="Edit" command="editProfile"></x-button>
            </div>
        </x-card>
        <p>Last action: {{ state.action }}</p>
        <pre x-pre><code>&lt;x-card&gt;
    &lt;h3 slot="header"&gt;User profile&lt;/h3&gt;
    &lt;p&gt;Profile details&lt;/p&gt;
    &lt;div slot="footer"&gt;
        &lt;x-button label="Edit" command="editProfile"&gt;&lt;/x-button&gt;
    &lt;/div&gt;
&lt;/x-card&gt;</code></pre>

        <h2>Empty-state composition</h2>
        <p>The <code>x-empty</code> Component provides a default slot for additional content and an <code>actions</code> slot for buttons.</p>
        <x-empty x-if="!state.hasFiles" icon="x-folder" label="No files" message="Add a sample file to continue.">
            <p>The file collection is currently empty.</p>
            <x-button slot="actions" icon="x-add" label="Add sample file" command="addFile"></x-button>
        </x-empty>
        <x-card x-else>
            <h3 slot="header">Files</h3>
            <p><x-icon icon="x-file"></x-icon> Example.txt</p>
            <div slot="footer">
                <x-button label="Remove file" command="removeFile"></x-button>
            </div>
        </x-card>
        <pre x-pre><code>&lt;x-empty icon="x-folder" label="No files" message="Add a file to continue."&gt;
    &lt;p&gt;Additional information.&lt;/p&gt;
    &lt;x-button slot="actions" label="Add file" command="addFile"&gt;&lt;/x-button&gt;
&lt;/x-empty&gt;</code></pre>

        <h2>Toolbar composition</h2>
        <p>The <code>x-toolbar</code> Component arranges arbitrary child Components through its default slot.</p>
        <x-toolbar>
            <x-button icon="x-add" label="New" command="newItem"></x-button>
            <x-button icon="x-file" label="Open" command="openItem"></x-button>
            <x-divider></x-divider>
            <x-button label="Refresh" command="refreshItems"></x-button>
        </x-toolbar>
        <p>Toolbar action: {{ state.toolbarAction }}</p>
        <pre x-pre><code>&lt;x-toolbar&gt;
    &lt;x-button label="New" command="newItem"&gt;&lt;/x-button&gt;
    &lt;x-divider&gt;&lt;/x-divider&gt;
    &lt;x-button label="Refresh" command="refreshItems"&gt;&lt;/x-button&gt;
&lt;/x-toolbar&gt;</code></pre>

        <h2>Dropdown composition</h2>
        <p>Use the default slot for the dropdown trigger and the <code>dropdown</code> slot for its expandable content.</p>
        <x-dropdown>
            <x-button label="More actions" icon="x-settings"></x-button>
            <div slot="dropdown">
                <x-button class="menuitem" label="Settings" command="showSettings"></x-button>
                <x-button class="menuitem" label="Information" command="showInformation"></x-button>
            </div>
        </x-dropdown>
        <p>Selected action: {{ state.dropdownAction }}</p>
        <pre x-pre><code>&lt;x-dropdown&gt;
    &lt;x-button label="More actions"&gt;&lt;/x-button&gt;
    &lt;div slot="dropdown"&gt;
        &lt;x-button label="Settings" command="showSettings"&gt;&lt;/x-button&gt;
    &lt;/div&gt;
&lt;/x-dropdown&gt;</code></pre>

        <h2>Nested Components</h2>
        <p>Components can contain other Components, each managing its own presentation and behavior.</p>
        <x-card>
            <h3 slot="header">Application settings</h3>
            <x-tabs>
                <x-tab label="General">
                    <x-datafields columns="2">
                        <x-datafield label="Application">XShell Cookbook</x-datafield>
                        <x-datafield label="Status"><x-badge value="Active"></x-badge></x-datafield>
                    </x-datafields>
                </x-tab>
                <x-tab label="Advanced">
                    <x-accordion>
                        <x-accordion-panel label="Details">
                            <p>Nested Components retain their own behavior.</p>
                        </x-accordion-panel>
                        <x-accordion-panel label="Options">
                            <x-button label="Apply" command="applySettings"></x-button>
                        </x-accordion-panel>
                    </x-accordion>
                </x-tab>
            </x-tabs>
        </x-card>
        <p>Settings action: {{ state.settingsAction }}</p>
        <pre x-pre><code>&lt;x-card&gt;
    &lt;x-tabs&gt;
        &lt;x-tab label="General"&gt;...&lt;/x-tab&gt;
        &lt;x-tab label="Advanced"&gt;
            &lt;x-accordion&gt;...&lt;/x-accordion&gt;
        &lt;/x-tab&gt;
    &lt;/x-tabs&gt;
&lt;/x-card&gt;</code></pre>
    `,

    state: {
        action: "None",
        hasFiles: false,
        toolbarAction: "None",
        dropdownAction: "None",
        settingsAction: "None"
    },

    controller({ state }) {
        return {
            editProfile() { state.action = "Edit profile"; },
            addFile() { state.hasFiles = true; },
            removeFile() { state.hasFiles = false; },
            newItem() { state.toolbarAction = "New"; },
            openItem() { state.toolbarAction = "Open"; },
            refreshItems() { state.toolbarAction = "Refresh"; },
            showSettings() { state.dropdownAction = "Settings"; },
            showInformation() { state.dropdownAction = "Information"; },
            applySettings() { state.settingsAction = "Applied"; }
        };
    }
};
