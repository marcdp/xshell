// export
export class RenderEnginePlain {
	
	// ctor
	constructor({ host, fragment, state }){
		this._host = host;
		this._fragment = fragment.cloneNode(true);
		this._state = state;
		this._page = page;
		this._dependencies = [];
	}

	// props
	get depenencies(){
		return this._dependencies;
	}

	// methods
	mount() {
		// add fragment to host DOM
		this._host.appendChild(this._fragment);
	}
	invalidate() {
		// No-op (plain HTML is static)
	}
	render() {
		// Plain engine does nothing:
		// DOM already exists, no diffing, no bindings
	}
	unmount() {
		// Cleanup if needed in the future
		this._host.replaceChildren();
		this._fragment = null;
	}


}
export default function createRenderEnginePlain(template) {
	return function RenderEngineFactory({host, state}) {
		debugger;
		return new RenderEnginePlain({ host, template, state });
	}
}