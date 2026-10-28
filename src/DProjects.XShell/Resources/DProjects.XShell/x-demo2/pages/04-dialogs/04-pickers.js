
export default {
    meta: {
        title: "Pickers",
        description: "Demonstrates picker dialogs, selection domains, initial values, validation, and returned results."
    },

    template: `
        <p>Use <code>dialog.picker()</code> to let the user select a value from a predefined list. Saving returns the selected value; cancelling returns <code>null</code>.</p>

        <h2>Basic pickers</h2>
        <p>Each picker receives a <code>domain</code> containing value and label pairs.</p>
        <p>
            <x-button label="Choose a color" command="chooseColor"></x-button>
            <x-button label="Choose a priority" command="choosePriority"></x-button>
        </p>
        <pre x-pre><code>const result = await dialog.picker({
    title: "Choose a color",
    domain: [
        {value:"red", label:"Red"},
        {value:"green", label:"Green"},
        {value:"blue", label:"Blue"}
    ],
    inputType: "select"
});</code></pre>

        <h2>Picker configuration</h2>
        <p>Use <code>value</code> to specify the initial selection and <code>required</code> to require a selection before saving.</p>
        <x-datafields columns="2">
            <x-datafield type="select" label="Initial value" placeholder="No selection" x-prop:domain="state.colors" x-model="state.initialValue"></x-datafield>
            <x-datafield type="checkbox" label="Required" label-secondary="A selection is required" x-model="state.required"></x-datafield>
        </x-datafields>
        <p><x-button class="submit" label="Open configured picker" command="openConfigured"></x-button></p>
        <pre x-pre><code>const result = await dialog.picker({
    title: "Choose a color",
    message: "Select a color.",
    domain: colors,
    inputType: "select",
    value: "green",
    placeholder: "Choose a color",
    required: true
});</code></pre>

        <h2>Picker options</h2>
        <p>The most common options control the available values and the selection behavior.</p>
        <x-datafields columns="2">
            <x-datafield label="title">Title displayed in the dialog</x-datafield>
            <x-datafield label="message">Instructions for the user</x-datafield>
            <x-datafield label="domain">Array of value and label pairs</x-datafield>
            <x-datafield label="inputType">Input control, such as select</x-datafield>
            <x-datafield label="value">Initially selected value</x-datafield>
            <x-datafield label="placeholder">Text displayed before selecting a value</x-datafield>
            <x-datafield label="required">Whether a selection is mandatory</x-datafield>
        </x-datafields>

        <h2>Asynchronous results</h2>
        <p>The <code>dialog.picker()</code> method returns a Promise. The returned value corresponds to the selected item's <code>value</code>, not its display label.</p>
        <p>Last picker: <strong>{{ state.lastAction }}</strong></p>
        <p>Returned value: <strong>{{ state.resultText }}</strong></p>
        <pre x-pre><code>const result = await dialog.picker({
    title: "Choose a color",
    domain: [{value:"red", label:"Red"}, {value:"blue", label:"Blue"}],
    inputType: "select"
});

if (result === null) {
    // The user cancelled.
} else {
    // Use the selected value.
}</code></pre>

        <h2>Multiple selection</h2>
        <p>The Picker service also exposes a <code>multiple</code> option. This example uses single selection because the current datafield/model integration does not reliably return multiple selections.</p>

        <h2>When to use pickers</h2>
        <p>Use pickers when the user should choose from known values. For entering a new value, see <x-anchor href="03-prompts.js">Prompts</x-anchor>. For yes/no decisions, see <x-anchor href="02-confirmations.js">Confirmations</x-anchor>.</p>
    `,

    state: {
        colors: [
            {value:"red", label:"Red"},
            {value:"green", label:"Green"},
            {value:"blue", label:"Blue"}
        ],
        priorities: [
            {value:"low", label:"Low"},
            {value:"normal", label:"Normal"},
            {value:"high", label:"High"}
        ],
        initialValue: "green",
        required: false,
        lastAction: "None",
        resultText: "No dialog opened"
    },

    controller({dialog, state}) {
        const openPicker = async (label, options) => {
            state.lastAction = label;
            const result = await dialog.picker(options);
            state.resultText = result === null ? "null (cancelled)" : JSON.stringify(result);
        };

        return {
            async chooseColor() {
                await openPicker("Color", {
                    title:"Choose a color",
                    message:"Select a color from the list.",
                    domain:state.colors,
                    inputType:"select",
                    value:"green"
                });
            },
            async choosePriority() {
                await openPicker("Priority", {
                    title:"Choose a priority",
                    message:"Select the priority level.",
                    domain:state.priorities,
                    inputType:"select",
                    value:"normal"
                });
            },
            async openConfigured() {
                await openPicker("Configured color picker", {
                    title:"Choose a color",
                    message:"Select a color and choose Save, or choose Cancel.",
                    domain:state.colors,
                    inputType:"select",
                    value:state.initialValue,
                    placeholder:"Choose a color",
                    multiple:false,
                    required:state.required
                });
            }
        };
    }
};
