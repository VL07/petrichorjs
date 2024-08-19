import {
    BeforeFunction,
    JoinLocals,
    Locals,
    Middleware,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Route } from "../route.js";
import { Method } from "../router.js";
import { HandlerFunction } from "../types/handler.js";
import {
    ParsedParsers,
    ParserFunctions,
    ParserFunctionsForPath,
} from "../types/parser.js";
import { Path } from "../types/path.js";
import {
    JoinValidators,
    UnvalidatedFunctions,
    ValidatedFunctions,
    ValidatorFunction,
    Validators,
    ValidatorType,
} from "../validate.js";
import { BuildableToRoutes } from "./index.js";

export interface RouteBuilderParsedAllMethods<
    R extends Path,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> {
    handle(handler: HandlerFunction<R, null, P, L, V>): void;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteBuilderParsedAllMethods<R, P, JoinLocals<R, T, L, P>, V>;
    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteBuilderParsedAllMethods<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
}

export interface RouteBuilderUnparsedAllMethods<
    R extends Path,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> extends RouteBuilderParsedAllMethods<R, P, L, V> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<R, P, JoinLocals<R, T, L, P>, V>;
    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteBuilderUnparsedAllMethods<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & ParsedParsers<T>, L, V>;
}

export class RouteBuilderAllMethods<
        R extends Path,
        P extends ParsedParsers,
        L extends Locals,
        V extends Validators,
    >
    implements RouteBuilderUnparsedAllMethods<R, P, L, V>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<R, null, P, L, V> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(readonly path: R) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & ParsedParsers<T>, L, V> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsedAllMethods<
            R,
            P & ParsedParsers<T>,
            L,
            V
        >;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<R, P, JoinLocals<R, T, L, P>, V> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                ParsedParsers,
                Validators
            >,
        });

        return this as unknown as RouteBuilderUnparsedAllMethods<
            R,
            P,
            JoinLocals<R, T, L, P>,
            V
        >;
    }

    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteBuilderUnparsedAllMethods<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    > {
        for (const [type, validator] of Object.entries(validators)) {
            this.middleware.push({
                type: "Validator",
                validator: validator as ValidatorFunction<unknown>,
                validatorType: type as ValidatorType,
            });
        }

        return this as unknown as RouteBuilderUnparsedAllMethods<
            R,
            P,
            L,
            JoinValidators<ValidatedFunctions<T>, V>
        >;
    }

    handle(handler: HandlerFunction<R, null, P, L, V>): void {
        this.handler = handler;
    }

    build(): Route[] {
        if (!this.handler) throw "Route builder needs a handler!";

        return [
            new Route(
                this.path,
                null,
                this.parsers || {},
                this.handler as unknown as HandlerFunction<
                    Path,
                    Method[] | null,
                    NonNullable<unknown>,
                    NonNullable<unknown>,
                    Validators
                >,
                this.middleware.slice()
            ),
        ];
    }
}

