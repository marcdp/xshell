import JsonValidator from "../services/json-validator.js"
import xshell from "../xshell.js"

export default class LoaderDatasetUrl {

    async load(url, context) {
        // fetch the dataset from the given URL
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to load dataset '${url}': HTTP ${response.status} ${response.statusText}`
            );
        }
        const dataset = await response.json();
        // validate the fetched dataset
        const datasetSchema = await xshell.loader.load("schema:dataset");
        const result = new JsonValidator().validate(dataset, datasetSchema);
        if (!result.valid) {
            console.error(`Invalid dataset: ${url}`, result.errors);
            throw new Error(`Invalid dataset: ${url}`, { cause: result.errors });
        }
        // return
        return dataset;
    }
}