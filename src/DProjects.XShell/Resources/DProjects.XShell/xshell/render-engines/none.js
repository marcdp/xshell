
// export
export class RenderEngineNone {
	
	// ctor
	constructor({ host }){
		this._host = host;
	}

	// methods
	mount() {
    }
	render() {
	}
	unmount() {
    }


}
export default function createRenderEngineFactoryNone(template, context, templateRenderer) {
	// return
	return {
		dependencies: Object.freeze(Object.seal([])),
		slots: Object.freeze([]),
        init: () => {
		},
		create: ({host, state}) => {
			return new RenderEngineNone({ host });
		}
	};
}
