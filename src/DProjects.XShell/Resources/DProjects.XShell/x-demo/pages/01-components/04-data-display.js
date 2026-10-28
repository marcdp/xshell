
export default {
    meta: {
        title: "Data Display",
        description: "Demonstrates data fields, file sizes, dates, and JSON visualization."
    },

    template: `
        <p>Data display Components present structured information and formatted values without manual formatting.</p>

        <h2>Data fields</h2>
        <p>Use <code>x-datafields</code> to group labeled fields into columns. Each <code>x-datafield</code> provides a label and displays its content.</p>
        <x-datafields label="File information" columns="2">
            <x-datafield label="Name">report.pdf</x-datafield>
            <x-datafield label="Type">PDF document</x-datafield>
            <x-datafield label="Size"><x-file-size value="2048"></x-file-size></x-datafield>
            <x-datafield label="Created"><x-datetime value="2026-01-01T12:00:00Z"></x-datetime></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafields label="File information" columns="2"&gt;
    &lt;x-datafield label="Name"&gt;report.pdf&lt;/x-datafield&gt;
    &lt;x-datafield label="Size"&gt;&lt;x-file-size value="2048"&gt;&lt;/x-file-size&gt;&lt;/x-datafield&gt;
&lt;/x-datafields&gt;</code></pre>

        <h2>File sizes</h2>
        <p>The <code>x-file-size</code> component formats byte counts using appropriate units.</p>
        <p>Bytes: <x-file-size value="512"></x-file-size></p>
        <p>Kilobytes: <x-file-size value="2048"></x-file-size></p>
        <p>Megabytes: <x-file-size value="5242880"></x-file-size></p>
        <p>Gigabytes: <x-file-size value="1073741824"></x-file-size></p>
        <pre x-pre><code>&lt;x-file-size value="5242880"&gt;&lt;/x-file-size&gt;</code></pre>

        <h2>Dates and times</h2>
        <p>Use <code>x-datetime</code> to display localized dates and times. The <code>format</code> property overrides the default formatting.</p>
        <p>Date: <x-datetime value="2026-01-01T12:00:00Z" format="date"></x-datetime></p>
        <p>Time: <x-datetime value="2026-01-01T12:00:00Z" format="time"></x-datetime></p>
        <p>Date and time: <x-datetime value="2026-01-01T12:00:00Z" format="datetime"></x-datetime></p>
        <pre x-pre><code>&lt;x-datetime value="2026-01-01T12:00:00Z" format="datetime"&gt;&lt;/x-datetime&gt;</code></pre>

        <h2>JSON visualization</h2>
        <p>Use <code>x-json</code> to display structured data with syntax highlighting. The <code>value</code> property accepts a JavaScript object.</p>
        <x-json x-prop:value="state.record" indent="2"></x-json>
        <p>
            <x-button label="Change name" command="changeName"></x-button>
            <x-button label="Toggle active" command="toggleActive"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </p>
        <pre x-pre><code>&lt;x-json x-prop:value="state.record" indent="2"&gt;&lt;/x-json&gt;</code></pre>

        <h2>Reactive formatting</h2>
        <p>Display a changing byte count using a reactive property binding.</p>
        <p>Size: <x-file-size x-prop:value="state.size"></x-file-size></p>
        <p>
            <x-button label="Increase size" command="increaseSize"></x-button>
            <x-button label="Reset size" command="resetSize"></x-button>
        </p>
        <pre x-pre><code>&lt;x-file-size x-prop:value="state.size"&gt;&lt;/x-file-size&gt;</code></pre>

        
        <h2>Durations</h2>
        <p>Use <code>x-time-ms</code> to display durations in milliseconds.</p>
        <p>Short operation: <x-time-ms value="25"></x-time-ms></p>
        <p>Long operation: <x-time-ms value="1500"></x-time-ms></p>
        <p>Reactive duration: <x-time-ms x-prop:value="state.duration"></x-time-ms></p>
        <p>
            <x-button label="Increase duration" command="increaseDuration"></x-button>
            <x-button label="Reset duration" command="resetDuration"></x-button>
        </p>
        <pre x-pre><code>&lt;x-time-ms value="1500"&gt;&lt;/x-time-ms&gt;
        &lt;x-time-ms x-prop:value="state.duration"&gt;&lt;/x-time-ms&gt;</code></pre>

    `,

    
    state: {
        record: { name: "Ada", active: true, role: "Developer" },
        size: 2048,
        duration: 250
    },


    controller({ state }) {
        return {
            changeName() { state.record = { ...state.record, name: state.record.name === "Ada" ? "Grace" : "Ada" }; },
            toggleActive() { state.record = { ...state.record, active: !state.record.active }; },
            reset() { state.record = { name: "Ada", active: true, role: "Developer" }; },
            increaseSize() { state.size *= 2; },
            resetSize() { state.size = 2048; },           
            increaseDuration() { state.duration += 100; },
            resetDuration() { state.duration = 250; }
        };
    }
};
