export default {
    template: `
        <h1>Indicators</h1>
        <p>Small components communicate status without custom scripts.</p>
        <p><x-icon icon="x-info"></x-icon> Information <x-badge value="3"></x-badge></p>
        <x-notice type="success" label="Saved" message="Local example completed."></x-notice>
        <x-progress value="60" min="0" max="100"></x-progress>
        <x-spinner message="Working"></x-spinner>
        <x-avatar initials="AD" label="Ada Developer"></x-avatar>
        
    `
};
