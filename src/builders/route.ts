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

interface RouteBuilderParsed<
    R extends Path,
    M extends Method[],
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> {
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
    handle(handler: HandlerFunction<R, M, P, L, V>): void;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteBuilderParsed<R, M, P, JoinLocals<R, T, L, P>, V>;
    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteBuilderParsed<R, M, P, L, JoinValidators<ValidatedFunctions<T>, V>>;
}

export interface RouteBuilderUnparsed<
    R extends Path,
    M extends Method[],
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> extends RouteBuilderParsed<R, M, P, L, V> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteBuilderUnparsed<R, M, P, JoinLocals<R, T, L, P>, V>;
    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteBuilderUnparsed<
        R,
        M,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
    on<T extends Method>(
        method: T
    ): RouteBuilderUnparsed<R, [...M, T], P, L, V>;
    get(): RouteBuilderUnparsed<R, [...M, "GET"], P, L, V>;
    post(): RouteBuilderUnparsed<R, [...M, "POST"], P, L, V>;
    put(): RouteBuilderUnparsed<R, [...M, "PUT"], P, L, V>;
    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"], P, L, V>;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsed<R, M, P & ParsedParsers<T>, L, V>;
}

export class RouteBuilder<
    R extends Path,
    M extends Method[],
    P extends ParsedParsers<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> implements RouteBuilderUnparsed<R, M, P, L, V>
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<R, M, P, L, V> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(
        readonly path: R,
        readonly methods: M
    ) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsed<R, M, P & ParsedParsers<T>, L, V> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsed<
            R,
            M,
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
    ): RouteBuilderUnparsed<R, M, P, JoinLocals<R, T, L, P>, V> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                ParsedParsers<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteBuilderUnparsed<
            R,
            M,
            P,
            JoinLocals<R, T, L, P>,
            V
        >;
    }

    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteBuilderUnparsed<
        R,
        M,
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

        return this as unknown as RouteBuilderUnparsed<
            R,
            M,
            P,
            L,
            JoinValidators<ValidatedFunctions<T>, V>
        >;
    }

    on<T extends Method>(
        method: T
    ): RouteBuilderUnparsed<R, [...M, T], P, L, V> {
        this.methods.push(method);
        return this as unknown as RouteBuilderUnparsed<R, [...M, T], P, L, V>;
    }

    get(): RouteBuilderUnparsed<R, [...M, "GET"], P, L, V> {
        return this.on("GET");
    }

    post(): RouteBuilderUnparsed<R, [...M, "POST"], P, L, V> {
        return this.on("POST");
    }

    put(): RouteBuilderUnparsed<R, [...M, "PUT"], P, L, V> {
        return this.on("PUT");
    }

    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"], P, L, V> {
        return this.on("DELETE");
    }

    handle(handler: HandlerFunction<R, M, P, L, V>): void {
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
                    this.handler as unknown as HandlerFunction<
                        Path,
                        Method[] | null,
                        NonNullable<unknown>,
                        NonNullable<unknown>,
                        Validators
                    >,
                    this.middleware.slice()
                )
            );
        }

        return routes;
    }
}

