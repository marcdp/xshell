
//data
let data = {
    culture: "en",
    strings: {
    }
};

// function
function i18n () {
    //todo ...
};

// config
i18n.init = async function(config) {
    this._config = config;
    Object.freeze(this._config);
};
Object.defineProperty(i18n, 'config', {
    get() {
        return data;
    },
  });

//export
export default i18n;