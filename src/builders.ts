import { Request } from "./request.js";
import { Response } from "./response.js";
import { Route } from "./route.js";
import type { Method, Path } from "./router.js";

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
type StaticEndRoute<T extends Path> = T extends `/${string}` ? {} : {};

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
    | Record<string, ParserFunction<any>>
    | ParserFunctionsForPath<Path, any>;

type A =
    ParserFunctionsForPath<"/:a", {}> extends ParserFunctions ? true : false;

/** Get the return type for the parser functions */
export type Parsed<T extends ParserFunctions> = {
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
> = {
    request: Request<R, M, DefaultOrParsedParams<R, P>, L>;
    response: Response<R, M>;
};

/** Handles the requests */
export type HandlerFunction<
    R extends Path,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> = (data: HandlerFunctionArguments<R, M, P, L>) => void | Promise<void>;

export type NextFunction = () => Promise<void> | void;

export interface MiddlewareContext {
    request: Request<
        Path,
        Method[] | null,
        Record<string, unknown>,
        Record<string, unknown>
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
          before: BeforeFunction;
      };

export type Middleware = (
    context: MiddlewareContext,
    next: NextFunction
) => Promise<void> | void;

export type Locals = Record<string, unknown>;

export type BeforeFunction = (
    request: Request<
        Path,
        [Method],
        Parsed<ParserFunctions>,
        Record<string, unknown>
    >
) => Promise<Locals> | Locals | Promise<void> | void;

export type JoinLocals<T extends BeforeFunction, U extends Locals> = Omit<
    U,
    keyof Awaited<ReturnType<T>>
> &
    Awaited<ReturnType<T>>;

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
> {
    handle(handler: HandlerFunction<R, null, P, L>): void;
}

export interface RouteBuilderUnparsedAllMethods<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> extends RouteBuilderParsedAllMethods<R, P, L> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<R, P, JoinLocals<T, L>>;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & Parsed<T>, L>;
}

interface RouteBuilderParsed<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
    L extends Locals,
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
    handle(handler: HandlerFunction<R, M, P, L>): void;
}

export interface RouteBuilderUnparsed<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> extends RouteBuilderParsed<R, M, P, L> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction>(
        beforeFunction: T
    ): RouteBuilderUnparsed<R, M, P, JoinLocals<T, L>>;
    on<T extends Method>(method: T): RouteBuilderUnparsed<R, [...M, T], P, L>;
    get(): RouteBuilderUnparsed<R, [...M, "GET"], P, L>;
    post(): RouteBuilderUnparsed<R, [...M, "POST"], P, L>;
    put(): RouteBuilderUnparsed<R, [...M, "PUT"], P, L>;
    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"], P, L>;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsed<R, M, P & Parsed<T>, L>;
}

interface RouteGroupBuilderParsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> {
    /** @see {@link RouteBuilderParsed.handle} */
    handle(): RouteGroup<R, P, L>;
}

export interface RouteGroupBuilderUnparsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> extends RouteGroupBuilderParsed<R, P, L> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<R, P, JoinLocals<T, L>>;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & Parsed<T>, L>;
}

interface RouteGroup<
    R extends Path,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> {
    on<T extends Method, U extends Path>(
        method: T,
        path: U
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P, L>;

    get<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P, L>;
    post<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P, L>;
    put<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P, L>;
    delete<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P, L>;

    all<T extends Path>(
        path: T
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P, L>;

    group<T extends Path>(
        path: T
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P, L>;
}

export class RouteBuilder<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
    L extends Locals,
> implements RouteBuilderUnparsed<R, M, P, L>
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<R, M, P, L> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(
        readonly path: R,
        readonly methods: M
    ) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsed<R, M, P & Parsed<T>, L> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsed<R, M, P & Parsed<T>, L>;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction>(
        beforeFunction: T
    ): RouteBuilderUnparsed<R, M, P, JoinLocals<T, L>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction,
        });

        return this as unknown as RouteBuilderUnparsed<
            R,
            M,
            P,
            JoinLocals<T, L>
        >;
    }

    on<T extends Method>(method: T): RouteBuilderUnparsed<R, [...M, T], P, L> {
        this.methods.push(method);
        return this as unknown as RouteBuilderUnparsed<R, [...M, T], P, L>;
    }

    get(): RouteBuilderUnparsed<R, [...M, "GET"], P, L> {
        return this.on("GET");
    }

    post(): RouteBuilderUnparsed<R, [...M, "POST"], P, L> {
        return this.on("POST");
    }

    put(): RouteBuilderUnparsed<R, [...M, "PUT"], P, L> {
        return this.on("PUT");
    }

    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"], P, L> {
        return this.on("DELETE");
    }

    handle(handler: HandlerFunction<R, M, P, L>): void {
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
                    this.handler,
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
    >
    implements RouteBuilderUnparsedAllMethods<R, P, L>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<R, null, P, L> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(readonly path: R) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & Parsed<T>, L> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsedAllMethods<
            R,
            P & Parsed<T>,
            L
        >;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction>(
        beforeFunction: T
    ): RouteBuilderUnparsedAllMethods<R, P, JoinLocals<T, L>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction,
        });

        return this as unknown as RouteBuilderUnparsedAllMethods<
            R,
            P,
            JoinLocals<T, L>
        >;
    }

    handle(handler: HandlerFunction<R, null, P, L>): void {
        this.handler = handler;
    }

    build(): Route[] {
        if (!this.handler) throw "Route builder needs a handler!";

        return [
            new Route(
                this.path,
                null,
                this.parsers || {},
                this.handler,
                this.middleware.slice()
            ),
        ];
    }
}

export class RouteGroupBuilder<
        R extends Path,
        P extends Parsed<ParserFunctions>,
        L extends Locals,
    >
    implements RouteGroupBuilderUnparsed<R, P, L>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    routeGroup: RouteGroupBackend<R, P, L> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(readonly path: R) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & Parsed<T>, L> {
        this.parsers = parsers;
        return this as unknown as RouteGroupBuilderParsed<R, P & Parsed<T>, L>;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<R, P, JoinLocals<T, L>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction,
        });

        return this as unknown as RouteGroupBuilderUnparsed<
            R,
            P,
            JoinLocals<T, L>
        >;
    }

    handle(): RouteGroup<R, P, L> {
        this.routeGroup = new RouteGroupBackend(this.path);
        return this.routeGroup;
    }

    build(): Route[] {
        if (!this.routeGroup) throw "Route group builder needs to be handled!";

        const routes = this.routeGroup.build();
        console.log("in route GROUP BUILDER", this.middleware);

        for (const route of routes) {
            route.middleware = [...this.middleware, ...route.middleware];
        }

        console.log("PREPARSE", routes);

        if (!this.parsers) return routes;

        for (const route of routes) {
            route.parsers = { ...route.parsers, ...this.parsers };
        }

        console.log("PARSED", routes);

        return routes;
    }
}

class RouteGroupBackend<
        R extends Path,
        P extends Parsed<ParserFunctions>,
        L extends Locals,
    >
    implements RouteGroup<R, P, L>, BuildableToRoutes
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
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P, L> {
        const builder = new RouteBuilder<JoinPaths<R, U>, [T], P, L>(
            this.joinPaths(path),
            [method]
        );
        this.routeBuilders.push(builder);

        return builder;
    }

    get<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P, L> {
        return this.on("GET", path);
    }

    post<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P, L> {
        return this.on("POST", path);
    }

    put<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P, L> {
        return this.on("PUT", path);
    }

    delete<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P, L> {
        return this.on("DELETE", path);
    }

    all<T extends Path>(
        path: T
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P, L> {
        const builder = new RouteBuilderAllMethods(
            (this.path + path) as JoinPaths<R, T>
        );
        this.routeBuilders.push(builder);

        // IDK why this one needs the as while the on method dosnt
        return builder as RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P, L>;
    }

    group<T extends Path>(
        path: T
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P, L> {
        const groupBuilder = new RouteGroupBuilder<JoinPaths<R, T>, P, L>(
            (this.path + path) as JoinPaths<R, T>
        );
        this.groupBuilders.push(groupBuilder);

        return groupBuilder;
    }

    build(): Route[] {
        const routes: Route[] = [];
        for (const builder of this.routeBuilders) {
            const built = builder.build();
            console.log("in backend", built);
            routes.push(...built);
        }

        for (const builder of this.groupBuilders) {
            routes.push(...builder.build());
        }

        return routes;
    }
}
