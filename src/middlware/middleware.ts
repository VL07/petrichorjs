import { Path } from "../types/path.js";
import { Request } from "../request.js";
import { Response } from "../response.js";
import { Method } from "../router.js";
import { ValidatorFunction, Validators, ValidatorType } from "../validate.js";
import {
    DefaultOrParsedParams,
    ParsedParsers,
    ParserFunctions,
} from "../types/parser.js";
import { Prettify } from "../types/common.js";

export type NextFunction = () => Promise<void> | void;

export interface MiddlewareContext {
    request: Request<
        Path | null,
        Method[] | null,
        Record<string, unknown>,
        Record<string, unknown>,
        Validators
    >;
    response: Response<Path, Method[] | null>;
}

export type MiddlewareOrBefore =
    | {
          type: "Middleware";
          middleware: Middleware;
      }
    | {
          type: "Before";
          before: BeforeFunction<Path, ParsedParsers>;
      }
    | {
          type: "Validator";
          validator: ValidatorFunction<unknown>;
          validatorType: ValidatorType;
      };

/** The type of middleware functions. */
export type Middleware = (
    context: MiddlewareContext,
    next: NextFunction
) => Promise<void> | void;

export type Locals = Record<string, unknown>;

export type BeforeFunction<
    R extends Path,
    P extends ParsedParsers,
    Re extends Locals = Record<string, unknown>,
> = (
    request: Request<
        Path | null,
        [Method],
        DefaultOrParsedParams<R, P>,
        Record<string, unknown>,
        Validators
    >
) => Re extends never
    ? Promise<Locals> | Locals | Promise<void> | void
    : Promise<Re> | Re;

export type JoinLocals<
    R extends Path,
    T extends BeforeFunction<R, P>,
    U extends Locals,
    P extends ParserFunctions,
> = Prettify<Omit<U, keyof Awaited<ReturnType<T>>> & Awaited<ReturnType<T>>>;

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

