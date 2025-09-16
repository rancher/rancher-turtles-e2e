import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import pluginCypress from 'eslint-plugin-cypress';

export default[
   pluginCypress.configs.recommended,

   {
    plugins: {
        "@typescript-eslint": typescriptEslint,
        "cypress": pluginCypress,
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 6,
        sourceType: "module",
    },

    rules: {
        "eol-last": ["error", "always"],
        "cypress/no-unnecessary-waiting": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "cypress/unsafe-to-chain-command": "off",
    },
}];
