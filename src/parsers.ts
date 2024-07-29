import { CustomParserFunction } from "./builders";

/**
 * Parse a param and ensure it's a number, uses the parseInt function under the hood.
 *
 * @example
 * ```ts
 * router.get("/users/:id").parse({
 *  id: intParser
 * }).handle(({request}) => {
 *  request.params.id // Will be of type number
 * })
 * ```
 *
 * @example
 * ```ts
 * ({request}) => {
 *  const id = request.query.getAndParse("id", intParser)
 *  // Id will be of type number
 * }
 * ```
 */
export const intParser: CustomParserFunction<string | undefined, number> = ({
    param,
    unparseable,
}) => {
    if (!param) return unparseable();

    const asInt = parseInt(param);
    if (isNaN(asInt)) return unparseable();

    return asInt;
};
