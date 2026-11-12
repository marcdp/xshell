export default {
    meta: {
        title: "Wizards",
        description: "Demonstrates standalone wizards and validated wizard forms."
    },

    template: `
        <p>
            XShell provides two wizard patterns. Use <code>x-wizard</code> for general step-by-step UI,
            and use <code>x-form wizard</code> when each step contains validated form fields.
        </p>

        <pre x-pre><code>x-wizard
    → navigation between arbitrary panels

x-form wizard
    → navigation + validation + final form submission</code></pre>


        <h2>Standalone wizard</h2>

        <p>
            A standalone wizard contains <code>x-wizard-panel</code> children.
            The wizard creates the progress header automatically and provides Previous and Next navigation.
        </p>

        <x-wizard>

            <x-wizard-panel
                label="Account"
                message="Basic information">

                <h3>Account</h3>

                <p>
                    This is the first step of the standalone wizard.
                </p>

                <x-datafields columns="2">
                    <x-datafield
                        type="text"
                        label="Username"
                        x-model="state.standalone.username">
                    </x-datafield>

                    <x-datafield
                        type="email"
                        label="Email"
                        x-model="state.standalone.email">
                    </x-datafield>
                </x-datafields>

            </x-wizard-panel>


            <x-wizard-panel
                label="Profile"
                message="Personal details">

                <h3>Profile</h3>

                <p>
                    Standalone wizard navigation does not validate fields before moving to the next panel.
                </p>

                <x-datafields columns="2">
                    <x-datafield
                        type="text"
                        label="First name"
                        x-model="state.standalone.firstName">
                    </x-datafield>

                    <x-datafield
                        type="text"
                        label="Last name"
                        x-model="state.standalone.lastName">
                    </x-datafield>
                </x-datafields>

            </x-wizard-panel>


            <x-wizard-panel
                label="Review"
                message="Check the values">

                <h3>Review</h3>

                <table>
                    <tbody>
                        <tr>
                            <td><strong>Username</strong></td>
                            <td>{{ state.standalone.username }}</td>
                        </tr>
                        <tr>
                            <td><strong>Email</strong></td>
                            <td>{{ state.standalone.email }}</td>
                        </tr>
                        <tr>
                            <td><strong>Name</strong></td>
                            <td>{{ state.standalone.firstName }} {{ state.standalone.lastName }}</td>
                        </tr>
                    </tbody>
                </table>

            </x-wizard-panel>


            <x-button
                slot="buttons"
                label="Finish"
                class="submit"
                x-on:click="standaloneFinish">
            </x-button>

        </x-wizard>

        <p x-if="state.standaloneCompleted">
            Standalone wizard completed.
        </p>


        <pre x-pre><code>&lt;x-wizard&gt;

    &lt;x-wizard-panel
        label="Account"
        message="Basic information"&gt;
        ...
    &lt;/x-wizard-panel&gt;

    &lt;x-wizard-panel
        label="Profile"
        message="Personal details"&gt;
        ...
    &lt;/x-wizard-panel&gt;

    &lt;x-wizard-panel
        label="Review"&gt;
        ...
    &lt;/x-wizard-panel&gt;

    &lt;x-button
        slot="buttons"
        label="Finish"&gt;
    &lt;/x-button&gt;

&lt;/x-wizard&gt;</code></pre>


        <x-divider></x-divider>


        <h2>Wizard form</h2>

        <p>
            When <code>wizard</code> is enabled on <code>x-form</code>, direct labeled children become wizard steps.
            The form validates the current step before allowing the user to continue.
        </p>

        <x-form
            wizard
            command="create">

            <div
                label="Account"
                message="Required account details">

                <h3>Account</h3>

                <x-datafields columns="2">
                    <x-datafield
                        type="text"
                        label="Name"
                        required
                        placeholder="Enter your name"
                        x-model="state.form.name">
                    </x-datafield>

                    <x-datafield
                        type="email"
                        label="Email"
                        required
                        placeholder="name@example.com"
                        x-model="state.form.email">
                    </x-datafield>
                </x-datafields>

                <p>
                    Leave a required value empty and choose <strong>Next</strong>.
                    The form remains on this step and displays the validation errors.
                </p>

            </div>


            <div
                label="Profile"
                message="Additional information">

                <h3>Profile</h3>

                <x-datafields columns="2">
                    <x-datafield
                        type="text"
                        label="Company"
                        x-model="state.form.company">
                    </x-datafield>

                    <x-datafield
                        type="number"
                        label="Age"
                        required
                        min="18"
                        max="120"
                        x-model="state.form.age">
                    </x-datafield>
                </x-datafields>

            </div>


            <div
                label="Review"
                message="Confirm the information">

                <h3>Review</h3>

                <table>
                    <tbody>
                        <tr>
                            <td><strong>Name</strong></td>
                            <td>{{ state.form.name }}</td>
                        </tr>

                        <tr>
                            <td><strong>Email</strong></td>
                            <td>{{ state.form.email }}</td>
                        </tr>

                        <tr>
                            <td><strong>Company</strong></td>
                            <td>{{ state.form.company }}</td>
                        </tr>

                        <tr>
                            <td><strong>Age</strong></td>
                            <td>{{ state.form.age }}</td>
                        </tr>
                    </tbody>
                </table>

            </div>


            <x-button
                slot="cancel"
                label="Reset"
                class="cancel"
                x-on:click="resetForm">
            </x-button>

            <x-button
                slot="footer"
                label="Create account"
                class="submit"
                command="submit">
            </x-button>

        </x-form>


        <pre x-pre><code>&lt;x-form wizard&gt;

    &lt;div
        label="Account"
        message="Required account details"&gt;

        &lt;x-datafield
            type="text"
            label="Name"
            required&gt;
        &lt;/x-datafield&gt;

    &lt;/div&gt;

    &lt;div
        label="Profile"
        message="Additional information"&gt;
        ...
    &lt;/div&gt;

    &lt;div
        label="Review"
        message="Confirm the information"&gt;
        ...
    &lt;/div&gt;

    &lt;x-button
        slot="footer"
        label="Create account"
        command="submit"&gt;
    &lt;/x-button&gt;

&lt;/x-form&gt;</code></pre>


        <x-divider></x-divider>


        <h2>Vertical wizard form</h2>

        <p>
            Set <code>wizard-direction="vertical"</code> to place the wizard header beside the current form step.
        </p>

        <x-form
            wizard
            wizard-direction="vertical">

            <div
                label="Connection"
                message="Server details">

                <h3>Connection</h3>

                <x-datafields>
                    <x-datafield
                        type="text"
                        label="Server"
                        required
                        x-model="state.connection.server">
                    </x-datafield>

                    <x-datafield
                        type="number"
                        label="Port"
                        required
                        min="1"
                        max="65535"
                        x-model="state.connection.port">
                    </x-datafield>
                </x-datafields>

            </div>


            <div
                label="Credentials"
                message="Authentication">

                <h3>Credentials</h3>

                <x-datafields>
                    <x-datafield
                        type="text"
                        label="Username"
                        required
                        x-model="state.connection.username">
                    </x-datafield>

                    <x-datafield
                        type="password"
                        label="Password"
                        required
                        x-model="state.connection.password">
                    </x-datafield>
                </x-datafields>

            </div>


            <div
                label="Finish"
                message="Review">

                <h3>Connection</h3>

                <table>
                    <tbody>
                        <tr>
                            <td><strong>Server</strong></td>
                            <td>{{ state.connection.server }}</td>
                        </tr>

                        <tr>
                            <td><strong>Port</strong></td>
                            <td>{{ state.connection.port }}</td>
                        </tr>

                        <tr>
                            <td><strong>Username</strong></td>
                            <td>{{ state.connection.username }}</td>
                        </tr>
                    </tbody>
                </table>

            </div>


            <x-button
                slot="footer"
                label="Connect"
                class="submit"
                x-on:click="connectionFinish">
            </x-button>

        </x-form>


        <pre x-pre><code>&lt;x-form
    wizard
    wizard-direction="vertical"&gt;

    &lt;div label="Connection"&gt;
        ...
    &lt;/div&gt;

    &lt;div label="Credentials"&gt;
        ...
    &lt;/div&gt;

    &lt;div label="Finish"&gt;
        ...
    &lt;/div&gt;

&lt;/x-form&gt;</code></pre>


        <x-divider></x-divider>


        <h2>Behavior summary</h2>

        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>x-wizard</th>
                    <th>x-form wizard</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Panels</strong></td>
                    <td>x-wizard-panel</td>
                    <td>Direct labeled children</td>
                </tr>

                <tr>
                    <td><strong>Header</strong></td>
                    <td>Automatic</td>
                    <td>Automatic</td>
                </tr>

                <tr>
                    <td><strong>Previous / Next</strong></td>
                    <td>Yes</td>
                    <td>Yes</td>
                </tr>

                <tr>
                    <td><strong>Previous-step navigation</strong></td>
                    <td>Yes</td>
                    <td>Yes</td>
                </tr>

                <tr>
                    <td><strong>Field validation before Next</strong></td>
                    <td>No</td>
                    <td>Yes</td>
                </tr>

                <tr>
                    <td><strong>x-form-assert validation</strong></td>
                    <td>No</td>
                    <td>Yes</td>
                </tr>

                <tr>
                    <td><strong>Final action slot</strong></td>
                    <td>buttons</td>
                    <td>footer</td>
                </tr>
            </tbody>
        </table>
    `,

    state: {
        standaloneCompleted: false,

        standalone: {
            username: "marc",
            email: "marc@example.com",
            firstName: "Marc",
            lastName: "Example"
        },

        form: {
            name: "",
            email: "",
            company: "",
            age: null
        },

        connection: {
            server: "localhost",
            port: 443,
            username: "",
            password: ""
        }
    },

    controller({ state }) {
        return {

            standaloneFinish() {
                state.standaloneCompleted = true;
            },

            resetForm() {
                state.form = {
                    name: "",
                    email: "",
                    company: "",
                    age: null
                };
            },

            create() {
                // x-form emits its configured command after successful validation.
                console.log("Create account", state.form);
            },

            connectionFinish() {
                console.log("Connect", {
                    server: state.connection.server,
                    port: state.connection.port,
                    username: state.connection.username
                });
            }

        };
    }
};
