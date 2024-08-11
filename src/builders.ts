import { Request } from "./request.js";
import { Response } from "./response.js";
import { Route } from "./route.js";
import type { Method, Path } from "./router.js";
import {
    JoinValidators,
    ValidatedFunctions,
    ValidatorFunction,
    ValidatorFunctions,
    Validators,
    ValidatorType,
} from "./validate.js";

type DynamicOptionalWildcardRoute<T extends Path> = T extends `/*?/${string}`
    ? never
    : DynamicWildcardRoute<T>;
type DynamicWildcardRoute<T extends Path> = T extends `/*/${string}`
    ? never
    : DynamicOptionalRoute<T>;
type DynamicOptionalRoute<T extends Path> = T extends `/:${string}?/${string}`
    ? never
    : DynamicRoute<T>;
type DynamicRoute<T extends Path> = T extends `/:${infer Name}/${infer Rest}`
    ? { [K in Name]: string } & Params<`/${Rest}`>
    : DynamicOptionalWildcardEndRoute<T>;
type DynamicOptionalWildcardEndRoute<T extends Path> = T extends `/*?`
    ? { wildcard: string | undefined }
    : DynamicWildcardEndRoute<T>;
type DynamicWildcardEndRoute<T extends Path> = T extends `/*`
    ? { wildcard: string }
    : DynamicOptionalEndRoute<T>;
type DynamicOptionalEndRoute<T extends Path> = T extends `/:${infer Name}?`
    ? { [K in Name]: string | undefined }
    : DynamicEndRoute<T>;
type DynamicEndRoute<T extends Path> = T extends `/:${infer Name}`
    ? { [K in Name]: string }
    : StaticRoute<T>;
type StaticRoute<T extends Path> = T extends `/${string}/${infer Rest}`
    ? Params<`/${Rest}`>
    : StaticEndRoute<T>;
type StaticEndRoute<T extends Path> = T extends `/${string}`
    ? NonNullable<unknown>
    : NonNullable<unknown>;

/** Get the params, and thire value, from a path */
type Params<T extends Path> = DynamicOptionalWildcardRoute<T>;

type UnparseableFunction = () => never;

/**
 * Parser function with the type of the param, throw Unparseable error if the
 * dynamic route is invalid
 */
export type ParserFunction<T> = (data: {
    param: T;
    unparseable: UnparseableFunction;
}) => unknown;

/** The type for custom parser functions */
export type CustomParserFunction<T, R> = (data: {
    param: T;
    unparseable: UnparseableFunction;
}) => R;

/**
 * The parser functions for a path, should only be used in frontend. Excludes
 * already parsed params
 */
type ParserFunctionsForPath<
    R extends Path,
    P extends Parsed<ParserFunctions>,
> = Partial<{
    [K in keyof ExcludeAlreadyParsed<R, P>]: ParserFunction<
        DefaultOrParsedParams<R, P>[K]
    >;
}>;

/** Exclued the already parsed from the route */
type ExcludeAlreadyParsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
> = Omit<Params<R>, keyof P>;

export type ParserFunctions =
    | Record<string, ParserFunction<NonNullable<unknown>>>
    | ParserFunctionsForPath<Path, NonNullable<unknown>>;

/** Get the return type for the parser functions */
export type Parsed<T extends ParserFunctions> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof T]: T[K] extends (...args: any) => any
        ? ReturnType<T[K]>
        : undefined;
};

/** Used for front facing params for a specific route */
type DefaultOrParsedParams<
    R extends Path,
    P extends Parsed<ParserFunctions>,
> = Omit<Params<R>, keyof P> & P;

export type HandlerFunctionArguments<
    R extends Path,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> = {
    request: Request<R, M, DefaultOrParsedParams<R, P>, L, V>;
    response: Response<R, M>;
};

/** Handles the requests */
export type HandlerFunction<
    R extends Path,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> = (data: HandlerFunctionArguments<R, M, P, L, V>) => void | Promise<void>;

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
          before: BeforeFunction<Path, Parsed<ParserFunctions>, Validators>;
      }
    | {
          type: "Validator";
          validator: ValidatorFunction<unknown>;
          validatorType: ValidatorType;
      };

export type Middleware = (
    context: MiddlewareContext,
    next: NextFunction
) => Promise<void> | void;

export type Locals = Record<string, unknown>;

export type BeforeFunction<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    V extends Validators,
    Re extends Locals = Record<string, unknown>,
> = (
    request: Request<
        Path | null,
        [Method],
        DefaultOrParsedParams<R, P>,
        Record<string, unknown>,
        V
    >
) => Re extends never ? Promise<Locals> | Locals | Promise<void> | void : Re;

export type JoinLocals<
    R extends Path,
    T extends BeforeFunction<R, P, V>,
    U extends Locals,
    P extends Parsed<ParserFunctions>,
    V extends Validators,
> = Omit<U, keyof Awaited<ReturnType<T>>> & Awaited<ReturnType<T>>;

/** Join two paths together */
type JoinPaths<A extends Path, B extends Path> = A extends "/"
    ? B
    : B extends "/"
      ? A
      : A extends `/${infer Slug}`
        ? `/${Slug}${B}`
        : never;

export interface BuildableToRoutes {
    build(): Route[];
}

interface RouteBuilderParsedAllMethods<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> {
    handle(handler: HandlerFunction<R, null, P, L, V>): void;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteBuilderParsedAllMethods<R, P, JoinLocals<R, T, L, P, V>, V>;
    validate<T extends Omit<ValidatorFunctions, keyof V>>(
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
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> extends RouteBuilderParsedAllMethods<R, P, L, V> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<R, P, JoinLocals<R, T, L, P, V>, V>;
    validate<T extends Omit<ValidatorFunctions, keyof V>>(
        validators: T
    ): RouteBuilderUnparsedAllMethods<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & Parsed<T>, L, V>;
}

interface RouteBuilderParsed<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
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
    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteBuilderParsed<R, M, P, JoinLocals<R, T, L, P, V>, V>;
    validate<T extends Omit<ValidatorFunctions, keyof V>>(
        validators: T
    ): RouteBuilderParsed<R, M, P, L, JoinValidators<ValidatedFunctions<T>, V>>;
}

export interface RouteBuilderUnparsed<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> extends RouteBuilderParsed<R, M, P, L, V> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteBuilderUnparsed<R, M, P, JoinLocals<R, T, L, P, V>, V>;
    validate<T extends Omit<ValidatorFunctions, keyof V>>(
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
    ): RouteBuilderParsed<R, M, P & Parsed<T>, L, V>;
}

interface RouteGroupBuilderParsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> {
    /** @see {@link RouteBuilderParsed.handle} */
    handle(): RouteGroup<R, P, L, V>;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteGroupBuilderParsed<R, P, JoinLocals<R, T, L, P, V>, V>;
    validate<T extends Omit<ValidatorFunctions, keyof V>>(
        validators: T
    ): RouteGroupBuilderParsed<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
}

export interface RouteGroupBuilderUnparsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> extends RouteGroupBuilderParsed<R, P, L, V> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<R, P, JoinLocals<R, T, L, P, V>, V>;
    validate<T extends Omit<ValidatorFunctions, keyof V>>(
        validators: T
    ): RouteGroupBuilderUnparsed<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & Parsed<T>, L, V>;
}

interface RouteGroup<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> {
    on<T extends Method, U extends Path>(
        method: T,
        path: U
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P, L, V>;

    get<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P, L, V>;
    post<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P, L, V>;
    put<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P, L, V>;
    delete<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P, L, V>;

    all<T extends Path>(
        path: T
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P, L, V>;

    group<T extends Path>(
        path: T
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P, L, V>;
}

export class RouteBuilder<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
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
    ): RouteBuilderParsed<R, M, P & Parsed<T>, L, V> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsed<R, M, P & Parsed<T>, L, V>;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteBuilderUnparsed<R, M, P, JoinLocals<R, T, L, P, V>, V> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                Parsed<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteBuilderUnparsed<
            R,
            M,
            P,
            JoinLocals<R, T, L, P, V>,
            V
        >;
    }

    validate<T extends Omit<ValidatorFunctions, keyof V>>(
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

export class RouteBuilderAllMethods<
        R extends Path,
        P extends Parsed<ParserFunctions>,
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
    ): RouteBuilderParsedAllMethods<R, P & Parsed<T>, L, V> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsedAllMethods<
            R,
            P & Parsed<T>,
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

    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<R, P, JoinLocals<R, T, L, P, V>, V> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                Parsed<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteBuilderUnparsedAllMethods<
            R,
            P,
            JoinLocals<R, T, L, P, V>,
            V
        >;
    }

    validate<T extends Omit<ValidatorFunctions, keyof V>>(
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

export class RouteGroupBuilder<
        R extends Path,
        P extends Parsed<ParserFunctions>,
        L extends Locals,
        V extends Validators,
    >
    implements RouteGroupBuilderUnparsed<R, P, L, V>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    routeGroup: RouteGroupBackend<R, P, L, V> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(readonly path: R) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & Parsed<T>, L, V> {
        this.parsers = parsers;
        return this as unknown as RouteGroupBuilderParsed<
            R,
            P & Parsed<T>,
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

    before<T extends BeforeFunction<R, P, V>>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<R, P, JoinLocals<R, T, L, P, V>, V> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                Parsed<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteGroupBuilderUnparsed<
            R,
            P,
            JoinLocals<R, T, L, P, V>,
            V
        >;
    }

    validate<T extends Omit<ValidatorFunctions, keyof V>>(
        validators: T
    ): RouteGroupBuilderUnparsed<
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

        return this as unknown as RouteGroupBuilderUnparsed<
            R,
            P,
            L,
            JoinValidators<ValidatedFunctions<T>, V>
        >;
    }

    handle(): RouteGroup<R, P, L, V> {
        this.routeGroup = new RouteGroupBackend(this.path);
        return this.routeGroup;
    }

    build(): Route[] {
        if (!this.routeGroup) throw "Route group builder needs to be handled!";

        const routes = this.routeGroup.build();

        for (const route of routes) {
            route.middleware = [...this.middleware, ...route.middleware];
        }

        for (const route of routes) {
            route.parsers = { ...route.parsers, ...this.parsers };
        }

        return routes;
    }
}

class RouteGroupBackend<
        R extends Path,
        P extends Parsed<ParserFunctions>,
        L extends Locals,
        V extends Validators,
    >
    implements RouteGroup<R, P, L, V>, BuildableToRoutes
{
    routeBuilders: BuildableToRoutes[] = [];
    groupBuilders: BuildableToRoutes[] = [];

    constructor(readonly path: R) {}

    private joinPaths<T extends Path>(path: T): JoinPaths<R, T> {
        return (((this.path as Path) === "/" ? "" : this.path) +
            ((path as Path) === "/" ? "" : path) || "/") as JoinPaths<R, T>;
    }

    on<T extends Method, U extends Path>(
        method: T,
        path: U
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P, L, V> {
        const builder = new RouteBuilder<JoinPaths<R, U>, [T], P, L, V>(
            this.joinPaths(path),
            [method]
        );
        this.routeBuilders.push(builder);

        return builder;
    }

    get<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P, L, V> {
        return this.on("GET", path);
    }

    post<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P, L, V> {
        return this.on("POST", path);
    }

    put<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P, L, V> {
        return this.on("PUT", path);
    }

    delete<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P, L, V> {
        return this.on("DELETE", path);
    }

    all<T extends Path>(
        path: T
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P, L, V> {
        const builder = new RouteBuilderAllMethods(
            (this.path + path) as JoinPaths<R, T>
        );
        this.routeBuilders.push(builder);

        // IDK why this one needs the as while the on method dosnt
        return builder as unknown as RouteBuilderUnparsedAllMethods<
            JoinPaths<R, T>,
            P,
            L,
            V
        >;
    }

    group<T extends Path>(
        path: T
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P, L, V> {
        const groupBuilder = new RouteGroupBuilder<JoinPaths<R, T>, P, L, V>(
            (this.path + path) as JoinPaths<R, T>
        );
        this.groupBuilders.push(groupBuilder);

        return groupBuilder;
    }

    build(): Route[] {
        const routes: Route[] = [];
        for (const builder of this.routeBuilders) {
            const built = builder.build();
            routes.push(...built);
        }

        for (const builder of this.groupBuilders) {
            routes.push(...builder.build());
        }

        return routes;
    }
}

