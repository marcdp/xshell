import globals from "globals";
import pluginJs from "@eslint/js";

// return eslint configuration settings
export default [
  {
    languageOptions: { 
      globals: globals.browser 
    },
    rules: {
      "semi": "error", 
      "no-debugger": 0
    }
  },
  pluginJs.configs.recommended,
];