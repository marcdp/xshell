
export default {
    meta: {
        title: "Prompts",
        description: "Demonstrates prompt input types, configuration options, validation, and returned values."
    },

    template: `
        <p>Use <code>dialog.prompt()</code> to request a single value from the user. The method returns the entered value when saved, or <code>null</code> when cancelled.</p>

        <h2>Basic prompts</h2>
        <p>Prompt dialogs support different input types. Choose an example to open a dialog and inspect its result.</p>
        <p>
            <x-button label="Text" command="promptText"></x-button>
            <x-button label="Number" command="promptNumber"></x-button>
            <x-button label="Password" command="promptPassword"></x-button>
        </p>
        <pre x-pre><code>const result = await dialog.prompt({
    title: "Your name",
    message: "Enter your name.",
    inputType: "text",
    value: "Ada"
});</code></pre>

        <h2>Prompt configuration</h2>
        <p>Use <code>inputType</code>, <code>value</code>, <code>placeholder</code>, and <code>required</code> to configure the prompt.</p>
        <x-datafields columns="2">
            <x-datafield type="select" label="Input type" x-prop:domain="state.inputTypes" x-model="state.inputType"></x-datafield>
            <x-datafield type="text" label="Initial value" x-model="state.initialValue"></x-datafield>
            <x-datafield type="text" label="Placeholder" x-model="state.placeholder"></x-datafield>
            <x-datafield type="checkbox" label="Required" label-secondary="A value is required" x-model="state.required"></x-datafield>
        </x-datafields>
        <p><x-button class="submit" label="Open configured prompt" command="openConfigured"></x-button></p>
        <pre x-pre><code>const result = await dialog.prompt({
    title: "Prompt example",
    message: "Enter a value.",
    inputType: "text",
    value: "Ada",
    placeholder: "Enter your name",
    required: true
});</code></pre>

        <h2>Prompt options</h2>
        <p>The most common options control the content and behavior of the input.</p>
        <x-datafields columns="2">
            <x-datafield label="title">Title displayed in the dialog</x-datafield>
            <x-datafield label="message">Instructions displayed above the input</x-datafield>
            <x-datafield label="inputType">text, number, or password</x-datafield>
            <x-datafield label="value">Initial input value</x-datafield>
            <x-datafield label="placeholder">Hint displayed when the input is empty</x-datafield>
            <x-datafield label="required">Whether a value must be provided</x-datafield>
        </x-datafields>

        <h2>Asynchronous results</h2>
        <p>The <code>dialog.prompt()</code> method returns a Promise. Saving returns the entered value; cancelling returns <code>null</code>.</p>
        <p>Last prompt: <strong>{{ state.lastAction }}</strong></p>
        <p>Returned value: <strong>{{ state.resultText }}</strong></p>
        <pre x-pre><code>const result = await dialog.prompt({
    title: "Your name",
    inputType: "text",
    value: "Ada"
});

if (result === null) {
    // The user cancelled.
} else {
    // Use the entered value.
}</code></pre>

        <h2>When to use prompts</h2>
        <p>Prompts are useful for collecting a single value without opening a complete form. For choosing from predefined options, see <x-anchor href="04-pickers.js">Pickers</x-anchor>. For simple decisions, use <x-anchor href="02-confirmations.js">Confirmations</x-anchor>.</p>
    `,

    state: {
        inputTypes: [
            {value:"text", label:"Text"},
            {value:"number", label:"Number"},
            {value:"password", label:"Password"}
        ],
        inputType: "text",
        initialValue: "Ada",
        placeholder: "Enter a value",
        required: false,
        lastAction: "None",
        resultText: "No dialog opened"
    },

    controller({dialog, state}) {
        const openPrompt = async (label, options) => {
            state.lastAction = label;
            const result = await dialog.prompt(options);
            state.resultText = result === null ? "null (cancelled)" : JSON.stringify(result);
        };

        return {
            async promptText() {
                await openPrompt("Text", {title:"Your name", message:"Enter your name.", inputType:"text", value:"Ada"});
            },
            async promptNumber() {
                await openPrompt("Number", {title:"Your age", message:"Enter your age.", inputType:"number", value:36});
            },
            async promptPassword() {
                await openPrompt("Password", {title:"Password", message:"Enter a sample password.", inputType:"password"});
            },
            async openConfigured() {
                await openPrompt(state.inputType, {
                    title:"Prompt example",
                    message:"Enter a value and choose Save, or choose Cancel.",
                    inputType:state.inputType,
                    value:state.inputType === "number" ? Number(state.initialValue) || 0 : state.initialValue,
                    placeholder:state.placeholder,
                    required:state.required
                });
            }
        };
    }
};
