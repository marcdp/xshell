// export
export default class RenderEnginePLain {
	
	// ctor
	constructor({ host, fragment, state, page }){
		debugger;
		this._host = host;
		this._fragment = fragment.cloneNode(true);
		this._state = state;
		this._page = page;
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