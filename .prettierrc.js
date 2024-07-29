/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
    plugins: ["prettier-plugin-jsdoc"],
    trailingComma: "es5",
    tabWidth: 4,
    semi: true,
    singleQuote: false,
    printWidth: 80,
};

export default config;
