/**
 * @type {import("prettier").Config}
 * @see https://prettier.io/docs/en/configuration.html
 */
const config = {
    plugins: ["prettier-plugin-jsdoc"],
    trailingComma: "es5",
    tabWidth: 4,
    semi: true,
    singleQuote: false,
    printWidth: 80,
    endOfLine: "crlf",
};

export default config;
