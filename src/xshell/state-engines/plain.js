// export
export default function createStateEngineFactory(stateDefinition) {

	// init state definition json
	const stateDefinitionJson = JSON.stringify(stateDefinition || {});

	// returns a state instance factory
	return function(handler) {
		return JSON.parse(stateDefinitionJson);
	};
}