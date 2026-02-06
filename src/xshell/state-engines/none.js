// export
export default function createStateEngineFactoryNone(stateDefinition) {

	// returns a state instance factory
	return {
		create: () => {
			return null;
		}
	};
}