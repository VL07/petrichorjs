import {
    BeforeFunction,
    Middleware,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Route } from "../route.js";
import { HandlerFunction } from "../types/handler.js";
import {
    ParsedParsers,
    ParserFunctions,
    ParserFunctionsForPath,
} from "../types/parser.js";
import { Path } from "../types/path.js";
import {
    UnvalidatedFunctions,
    ValidatedFunctions,
    ValidatorFunction,
    Validators,
    ValidatorType,
} from "../validate.js";
import {
    BeforeFunctionRouteBuilderContext,
    ParsedRouteBuilderContext,
    RouteBuilderContext,
    ValidateRouteBuilderContext,
} from "./context.js";
import { BuildableToRoutes } from "./index.js";

export interface RouteBuilderParsedAllMethods<C extends RouteBuilderContext> {
    handle(handler: HandlerFunction<C>): void;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteBuilderParsedAllMethods<BeforeFunctionRouteBuilderContext<C, T>>;
    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteBuilderParsedAllMethods<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    >;
}

export interface RouteBuilderUnparsedAllMethods<C extends RouteBuilderContext>
    extends RouteBuilderParsedAllMethods<C> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<BeforeFunctionRouteBuilderContext<C, T>>;
    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteBuilderUnparsedAllMethods<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    >;
    parse<T extends ParserFunctionsForPath<C["path"], C["parsed"]>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<
        ParsedRouteBuilderContext<C, ParsedParsers<T>>
    >;
}

export class RouteBuilderAllMethods<C extends RouteBuilderContext>
    implements RouteBuilderUnparsedAllMethods<C>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<C> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(readonly path: C["path"]) {}

    parse<T extends ParserFunctionsForPath<C["path"], C["parsed"]>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<
        ParsedRouteBuilderContext<C, ParsedParsers<T>>
    > {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsedAllMethods<
            ParsedRouteBuilderContext<C, ParsedParsers<T>>
        >;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<BeforeFunctionRouteBuilderContext<C, T>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                ParsedParsers,
                Validators
            >,
        });

        return this as unknown as RouteBuilderUnparsedAllMethods<
            BeforeFunctionRouteBuilderContext<C, T>
        >;
    }

    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteBuilderUnparsedAllMethods<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    > {
        for (const [type, validator] of Object.entries(validators)) {
            this.middleware.push({
                type: "Validator",
                validator: validator as ValidatorFunction<unknown>,
                validatorType: type as ValidatorType,
            });
        }

        return this as unknown as RouteBuilderUnparsedAllMethods<
            ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
        >;
    }

    handle(handler: HandlerFunction<C>): void {
        this.handler = handler;
    }

    build(): Route[] {
        if (!this.handler) throw "Route builder needs a handler!";

        return [
            new Route(
                this.path,
                null,
                this.parsers || {},
                this.handler as HandlerFunction<RouteBuilderContext>,
                this.middleware.slice()
            ),
        ];
    }
}

