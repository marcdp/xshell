// export
export default function createStateEngineFactoryPlain(stateDefinition) {
	// init state definition json
	const stateDefinitionJson = JSON.stringify(stateDefinition || {});
	// returns a state instance factory
	return {
		create: () => {
			return JSON.parse(stateDefinitionJson);
		}
	};
}