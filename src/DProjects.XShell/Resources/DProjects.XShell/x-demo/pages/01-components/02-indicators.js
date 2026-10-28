
export default {
    meta: {
        title: "Indicators",
        description: "Demonstrates icons, badges, notices, progress bars, spinners, and avatars."
    },

    template: `
        <p>Indicators communicate status, progress, and identity using small reusable Components.</p>

        <h2>Icons</h2>
        <p>Use <code>x-icon</code> to display SVG icons from XShell resources.</p>
        <p>
            <x-icon icon="x-info"></x-icon> Information
            <x-icon icon="x-success"></x-icon> Success
            <x-icon icon="x-warning"></x-icon> Warning
            <x-icon icon="x-error"></x-icon> Error
        </p>
        <pre x-pre><code>&lt;x-icon icon="x-info"&gt;&lt;/x-icon&gt;
&lt;x-icon icon="x-success"&gt;&lt;/x-icon&gt;</code></pre>

        <h2>Badges</h2>
        <p>Use <code>x-badge</code> to display short values such as counts or notifications.</p>
        <p>
            Messages <x-badge value="3"></x-badge>
            Notifications <x-badge value="12"></x-badge>
            Status <x-badge class="plain" value="New"></x-badge>
        </p>
        <pre x-pre><code>&lt;x-badge value="3"&gt;&lt;/x-badge&gt;
&lt;x-badge class="plain" value="New"&gt;&lt;/x-badge&gt;</code></pre>

        <h2>Notices</h2>
        <p>Use <code>x-notice</code> to communicate information, success, warnings, errors, or ongoing work.</p>
        <x-notice type="info" label="Information" message="This is an informational notice."></x-notice>
        <x-notice type="success" label="Success" message="The operation completed successfully."></x-notice>
        <x-notice type="warning" label="Warning" message="Review the information before continuing."></x-notice>
        <x-notice type="error" label="Error" message="The operation could not be completed."></x-notice>
        <x-notice type="working" label="Working" message="Processing the request."></x-notice>
        <pre x-pre><code>&lt;x-notice type="success" label="Saved" message="Changes saved."&gt;&lt;/x-notice&gt;
&lt;x-notice type="warning" label="Warning" message="Check the values."&gt;&lt;/x-notice&gt;</code></pre>

        <h2>Progress</h2>
        <p>Use <code>x-progress</code> for operations with measurable progress. The value can be updated through reactive state.</p>
        <p>Progress: {{ state.progress }}%</p>
        <x-progress x-prop:value="state.progress" min="0" max="100"></x-progress>
        <p>
            <x-button label="Increase" command="increase"></x-button>
            <x-button label="Decrease" command="decrease"></x-button>
            <x-button label="Reset" command="reset"></x-button>
        </p>
        <pre x-pre><code>&lt;x-progress x-prop:value="state.progress" min="0" max="100"&gt;&lt;/x-progress&gt;</code></pre>

        <h2>Spinners</h2>
        <p>Use <code>x-spinner</code> when an operation is running and its progress is unknown.</p>
        <p><x-spinner></x-spinner></p>
        <p><x-spinner message="Loading data..."></x-spinner></p>
        <pre x-pre><code>&lt;x-spinner&gt;&lt;/x-spinner&gt;
&lt;x-spinner message="Loading data..."&gt;&lt;/x-spinner&gt;</code></pre>

        <h2>Avatars</h2>
        <p>Use <code>x-avatar</code> to represent users with initials, icons, or images.</p>
        <p><x-avatar initials="AD" label="Ada Developer" message="Administrator"></x-avatar></p>
        <p><x-avatar icon="x-info" label="System" message="Automated account"></x-avatar></p>
        <pre x-pre><code>&lt;x-avatar initials="AD" label="Ada Developer" message="Administrator"&gt;&lt;/x-avatar&gt;
&lt;x-avatar icon="x-info" label="System"&gt;&lt;/x-avatar&gt;</code></pre>
    `,

    state: {
        progress: 60
    },

    controller({ state }) {
        return {
            increase() { state.progress = Math.min(100, state.progress + 10); },
            decrease() { state.progress = Math.max(0, state.progress - 10); },
            reset() { state.progress = 0; }
        };
    }
};
