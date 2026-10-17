export default class LoaderDatasetUrl {

    async load(url, context) {
        debugger
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to load dataset '${url}': HTTP ${response.status} ${response.statusText}`
            );
        }
        return await response.json();
    }
}