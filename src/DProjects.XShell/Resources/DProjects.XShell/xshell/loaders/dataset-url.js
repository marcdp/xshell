import validateDataset from "../validation/dataset.js";

export default class LoaderDatasetUrl {

    async load(url, context) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to load dataset '${url}': HTTP ${response.status} ${response.statusText}`
            );
        }
        const dataset = await response.json();
        await validateDataset(url, dataset);
        return dataset;
    }
}