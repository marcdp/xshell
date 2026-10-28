
export default {
    meta: {
        title: "Layouts",
        description: "Demonstrates cards, tabs, accordions, dividers, and reactive content composition."
    },

    template: `
        <p>Layout Components organize content into reusable visual structures. Cards group content, tabs switch between panels, and accordions reveal collapsible sections.</p>

        <h2>Cards</h2>
        <p>Use <code>x-card</code> to group related content in a bordered container.</p>
        <x-card>
            <h3>Simple card</h3>
            <p>A card can contain text, Components, and other HTML elements.</p>
            <x-badge value="Active"></x-badge>
        </x-card>
        <pre x-pre><code>&lt;x-card&gt;
    &lt;h3&gt;Simple card&lt;/h3&gt;
    &lt;p&gt;Card content.&lt;/p&gt;
&lt;/x-card&gt;</code></pre>

        <h2>Card slots</h2>
        <p>Cards provide <code>header</code>, default content, and <code>footer</code> slots.</p>
        <x-card>
            <h3 slot="header">User profile</h3>
            <p><strong>Name:</strong> Ada Developer</p>
            <p><strong>Role:</strong> Administrator</p>
            <div slot="footer">
                <x-button label="Edit profile" command="editProfile"></x-button>
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

        <h2>Tabs</h2>
        <p>Use <code>x-tabs</code> and <code>x-tab</code> to organize related content into selectable panels.</p>
        <x-tabs>
            <x-tab label="Overview">
                <p>This is the overview panel.</p>
                <x-badge value="Ready"></x-badge>
            </x-tab>
            <x-tab label="Details">
                <p>This panel contains additional information.</p>
                <x-datafields columns="2">
                    <x-datafield label="Name">Example</x-datafield>
                    <x-datafield label="Status">Active</x-datafield>
                </x-datafields>
            </x-tab>
            <x-tab label="Settings">
                <p>Panels can contain interactive Components.</p>
                <x-button label="Toggle setting" command="toggleSetting"></x-button>
                <p>Setting enabled: {{ state.enabled }}</p>
            </x-tab>
        </x-tabs>
        <pre x-pre><code>&lt;x-tabs&gt;
    &lt;x-tab label="Overview"&gt;Overview content&lt;/x-tab&gt;
    &lt;x-tab label="Details"&gt;Details content&lt;/x-tab&gt;
    &lt;x-tab label="Settings"&gt;Settings content&lt;/x-tab&gt;
&lt;/x-tabs&gt;</code></pre>

        <h2>Initial tab selection</h2>
        <p>Use <code>selected-index</code> to specify which tab is initially displayed. Indexes start at zero.</p>
        <x-tabs selected-index="1">
            <x-tab label="First"><p>First panel.</p></x-tab>
            <x-tab label="Second"><p>The second panel is selected initially.</p></x-tab>
            <x-tab label="Third"><p>Third panel.</p></x-tab>
        </x-tabs>
        <pre x-pre><code>&lt;x-tabs selected-index="1"&gt;
    &lt;x-tab label="First"&gt;First panel&lt;/x-tab&gt;
    &lt;x-tab label="Second"&gt;Second panel&lt;/x-tab&gt;
&lt;/x-tabs&gt;</code></pre>

        <h2>Accordions</h2>
        <p>Use <code>x-accordion</code> to group expandable panels. Opening one panel closes the other panels in the group.</p>
        <x-accordion>
            <x-accordion-panel label="General" expanded>
                <p>General information about the selected item.</p>
            </x-accordion-panel>
            <x-accordion-panel label="Details">
                <p>Additional information displayed when expanded.</p>
            </x-accordion-panel>
            <x-accordion-panel label="Advanced">
                <p>Advanced settings and optional configuration.</p>
            </x-accordion-panel>
        </x-accordion>
        <pre x-pre><code>&lt;x-accordion&gt;
    &lt;x-accordion-panel label="General" expanded&gt;
        General information
    &lt;/x-accordion-panel&gt;
    &lt;x-accordion-panel label="Details"&gt;
        Additional details
    &lt;/x-accordion-panel&gt;
&lt;/x-accordion&gt;</code></pre>

        <h2>Accordion panel icons</h2>
        <p>Panels support an optional <code>icon</code> property and a <code>toolbar</code> slot.</p>
        <x-accordion>
            <x-accordion-panel label="Information" icon="x-info">
                <p>Information content.</p>
            </x-accordion-panel>
            <x-accordion-panel label="Settings" icon="x-settings">
                <p>Settings content.</p>
            </x-accordion-panel>
        </x-accordion>
        <pre x-pre><code>&lt;x-accordion-panel label="Information" icon="x-info"&gt;
    Information content
&lt;/x-accordion-panel&gt;</code></pre>

        <h2>Dividers</h2>
        <p>Use <code>x-divider</code> to visually separate related sections.</p>
        <p>First section</p>
        <x-divider></x-divider>
        <p>Second section</p>
        <pre x-pre><code>&lt;p&gt;First section&lt;/p&gt;
&lt;x-divider&gt;&lt;/x-divider&gt;
&lt;p&gt;Second section&lt;/p&gt;</code></pre>

    `,

    state: {
        action: "None",
        enabled: false
    },

    controller({ state }) {
        return {
            editProfile() { state.action = "Edit profile clicked"; },
            toggleSetting() { state.enabled = !state.enabled; }
        };
    }
};
