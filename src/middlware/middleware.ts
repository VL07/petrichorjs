import { BeforeFunction, Locals, Middleware } from "../builders.js";
import { Path } from "../router.js";

/**
 * Wrap the middleware function in this function to get typechecking.
 *
 * @example
 *     const myMiddleware = middleware(({ request, response }, next) => {
 *         await next();
 *     });
 */
export function middleware<T extends Middleware>(middlewareFunction: T): T {
    return middlewareFunction;
}

/**
 * Wrap the before function in this function to get typechecking.
 *
 * @example
 *     const myBeforeFunction = beforeFunction(async (request) => {
 *         return {
 *             user: getUser(request),
 *         };
 *     });
 */
export function beforeFunction<
    P extends Record<string, unknown>,
    R extends Locals,
    T extends BeforeFunction<Path, P, R> = BeforeFunction<Path, P, R>,
>(beforeFunction: T): T {
    return beforeFunction;
}
