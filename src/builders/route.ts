import {
    BeforeFunction,
    Middleware,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Route } from "../route.js";
import { Method } from "../router/router.js";
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
    AddMethodRouteBuilderContext,
    BeforeFunctionRouteBuilderContext,
    ParsedRouteBuilderContext,
    RouteBuilderContext,
    ValidateRouteBuilderContext,
} from "./context.js";

interface RouteBuilderParsed<C extends RouteBuilderContext<Path, Method[]>> {
    /**
     * Takes a callback function that runs on requests to this route. It runs
     * inbetween all middleware, and after all before functions. All route
     * builders has to have a handler.
     *
     * @example
     *     router
     *         .get("/user/:id")
     *         .parse({ id: intParser })
     *         .handle(async ({ request, response }) => {
     *             return response.ok().json(await getUser(request.params.id));
     *         });
     *
     * @see {@link Request}
     * @see {@link Response}
     */
    handle(handler: HandlerFunction<C>): void;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteBuilderParsed<BeforeFunctionRouteBuilderContext<C, T>>;
    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteBuilderParsed<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    >;
}

export interface RouteBuilderUnparsed<
    C extends RouteBuilderContext<Path, Method[]>,
> extends RouteBuilderParsed<C> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteBuilderUnparsed<BeforeFunctionRouteBuilderContext<C, T>>;
    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteBuilderUnparsed<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    >;
    on<T extends Method>(
        method: T
    ): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, T>>;
    get(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "GET">>;
    post(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "POST">>;
    put(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "PUT">>;
    delete(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "DELETE">>;
    parse<T extends ParserFunctionsForPath<C["path"], C["parsed"]>>(
        parsers: T
    ): RouteBuilderParsed<ParsedRouteBuilderContext<C, ParsedParsers<T>>>;
}

export class RouteBuilder<C extends RouteBuilderContext<Path, Method[]>>
    implements RouteBuilderUnparsed<C>
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<C> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(
        readonly path: C["path"],
        readonly methods: Method[]
    ) {}

    parse<T extends ParserFunctionsForPath<C["path"], C["parsed"]>>(
        parsers: T
    ): RouteBuilderParsed<ParsedRouteBuilderContext<C, ParsedParsers<T>>> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsed<
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
    ): RouteBuilderUnparsed<BeforeFunctionRouteBuilderContext<C, T>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                ParsedParsers<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteBuilderUnparsed<
            BeforeFunctionRouteBuilderContext<C, T>
        >;
    }

    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteBuilderUnparsed<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    > {
        for (const [type, validator] of Object.entries(validators)) {
            this.middleware.push({
                type: "Validator",
                validator: validator as ValidatorFunction<unknown>,
                validatorType: type as ValidatorType,
            });
        }

        return this as unknown as RouteBuilderUnparsed<
            ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
        >;
    }

    on<T extends Method>(
        method: T
    ): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, T>> {
        this.methods.push(method);
        return this as unknown as RouteBuilderUnparsed<
            AddMethodRouteBuilderContext<C, T>
        >;
    }

    get(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "GET">> {
        return this.on("GET");
    }

    post(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "POST">> {
        return this.on("POST");
    }

    put(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "PUT">> {
        return this.on("PUT");
    }

    delete(): RouteBuilderUnparsed<AddMethodRouteBuilderContext<C, "DELETE">> {
        return this.on("DELETE");
    }

    handle(handler: HandlerFunction<C>): void {
        this.handler = handler;
    }

    build(): Route[] {
        if (!this.handler) throw "Route builder needs a handler!";

        const routes: Route[] = [];
        for (const method of this.methods) {
            routes.push(
                new Route(
                    this.path,
                    method,
                    this.parsers || {},
                    this.handler as HandlerFunction<RouteBuilderContext>,
                    this.middleware.slice()
                )
            );
        }

        return routes;
    }
}

