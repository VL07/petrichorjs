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
> = {
    request: Request<R, M, DefaultOrParsedParams<R, P>>;
    response: Response<R, M>;
};

/** Handles the requests */
export type HandlerFunction<
    R extends Path,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
> = (data: HandlerFunctionArguments<R, M, P>) => void | Promise<void>;

export type NextFunction = () => Promise<void> | void;

export interface MiddlewareContext {
    request: Request<Path, Method[] | null, Record<string, unknown>>;
    response: Response<Path, Method[] | null>;
}

export type Middleware = (
    context: MiddlewareContext,
    next: NextFunction
) => Promise<void> | void;

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
> {
    handle(handler: HandlerFunction<R, null, P>): void;
}

export interface RouteBuilderUnparsedAllMethods<
    R extends Path,
    P extends Parsed<ParserFunctions>,
> extends RouteBuilderParsedAllMethods<R, P> {
    use(middleware: Middleware): this;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & Parsed<T>>;
}

interface RouteBuilderParsed<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
> {
    handle(handler: HandlerFunction<R, M, P>): void;
}

export interface RouteBuilderUnparsed<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
> extends RouteBuilderParsed<R, M, P> {
    use(middleware: Middleware): this;
    on<T extends Method>(method: T): RouteBuilderUnparsed<R, [...M, T], P>;
    get(): RouteBuilderUnparsed<R, [...M, "GET"], P>;
    post(): RouteBuilderUnparsed<R, [...M, "POST"], P>;
    put(): RouteBuilderUnparsed<R, [...M, "PUT"], P>;
    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"], P>;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsed<R, M, P & Parsed<T>>;
}

interface RouteGroupBuilderParsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
> {
    handle(): RouteGroup<R, P>;
}

export interface RouteGroupBuilderUnparsed<
    R extends Path,
    P extends Parsed<ParserFunctions>,
> extends RouteGroupBuilderParsed<R, P> {
    use(middleware: Middleware): this;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & Parsed<T>>;
}

interface RouteGroup<R extends Path, P extends Parsed<ParserFunctions>> {
    on<T extends Method, U extends Path>(
        method: T,
        path: U
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P>;

    get<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P>;
    post<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P>;
    put<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P>;
    delete<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P>;

    all<T extends Path>(
        path: T
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P>;

    group<T extends Path>(
        path: T
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P>;
}

export class RouteBuilder<
    R extends Path,
    M extends Method[],
    P extends Parsed<ParserFunctions>,
> implements RouteBuilderUnparsed<R, M, P>
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<R, M, P> | undefined;
    middleware: Middleware[] = [];

    constructor(
        readonly path: R,
        readonly methods: M
    ) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsed<R, M, P & Parsed<T>> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsed<R, M, P & Parsed<T>>;
    }

    use(middleware: Middleware): this {
        this.middleware.push(middleware);
        return this;
    }

    on<T extends Method>(method: T): RouteBuilderUnparsed<R, [...M, T], P> {
        this.methods.push(method);
        return this as unknown as RouteBuilderUnparsed<R, [...M, T], P>;
    }

    get(): RouteBuilderUnparsed<R, [...M, "GET"], P> {
        return this.on("GET");
    }

    post(): RouteBuilderUnparsed<R, [...M, "POST"], P> {
        return this.on("POST");
    }

    put(): RouteBuilderUnparsed<R, [...M, "PUT"], P> {
        return this.on("PUT");
    }

    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"], P> {
        return this.on("DELETE");
    }

    handle(handler: HandlerFunction<R, M, P>): void {
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
                    this.middleware.reverse()
                )
            );
        }

        return routes;
    }
}

export class RouteBuilderAllMethods<
        R extends Path,
        P extends Parsed<ParserFunctions>,
    >
    implements RouteBuilderUnparsedAllMethods<R, P>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    handler: HandlerFunction<R, null, P> | undefined;
    middleware: Middleware[] = [];

    constructor(readonly path: R) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteBuilderParsedAllMethods<R, P & Parsed<T>> {
        this.parsers = parsers;
        return this as unknown as RouteBuilderParsedAllMethods<
            R,
            P & Parsed<T>
        >;
    }

    use(middleware: Middleware): this {
        this.middleware.push(middleware);
        return this;
    }

    handle(handler: HandlerFunction<R, null, P>): void {
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
                this.middleware.reverse()
            ),
        ];
    }
}

export class RouteGroupBuilder<
        R extends Path,
        P extends Parsed<ParserFunctions>,
    >
    implements RouteGroupBuilderUnparsed<R, P>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    routeGroup: RouteGroupBackend<R, P> | undefined;
    middleware: Middleware[] = [];

    constructor(readonly path: R) {}

    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & Parsed<T>> {
        this.parsers = parsers;
        return this as unknown as RouteGroupBuilderParsed<R, P & Parsed<T>>;
    }

    use(middleware: Middleware): this {
        this.middleware.push(middleware);
        return this;
    }

    handle(): RouteGroup<R, P> {
        this.routeGroup = new RouteGroupBackend(this.path, this.middleware);
        return this.routeGroup;
    }

    build(): Route[] {
        if (!this.routeGroup) throw "Route group builder needs to be handled!";

        const routes = this.routeGroup.build();
        if (!this.parsers) return routes;

        for (const route of routes) {
            route.parsers = { ...route.parsers, ...this.parsers };
        }

        return routes;
    }
}

class RouteGroupBackend<R extends Path, P extends Parsed<ParserFunctions>>
    implements RouteGroup<R, P>, BuildableToRoutes
{
    routeBuilders: BuildableToRoutes[] = [];
    groupBuilders: BuildableToRoutes[] = [];
    readonly middleware: Middleware[] = [];

    constructor(
        readonly path: R,
        middleware: Middleware[]
    ) {
        this.middleware = middleware.reverse();
    }

    on<T extends Method, U extends Path>(
        method: T,
        path: U
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P> {
        const builder = new RouteBuilder<JoinPaths<R, U>, [T], P>(
            (this.path + path) as JoinPaths<R, U>,
            [method]
        );
        this.routeBuilders.push(builder);

        return builder;
    }

    get<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P> {
        return this.on("GET", path);
    }

    post<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P> {
        return this.on("POST", path);
    }

    put<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P> {
        return this.on("PUT", path);
    }

    delete<T extends Path>(
        path: T
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P> {
        return this.on("DELETE", path);
    }

    all<T extends Path>(
        path: T
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P> {
        const builder = new RouteBuilderAllMethods(
            (this.path + path) as JoinPaths<R, T>
        );
        this.routeBuilders.push(builder);

        // IDK why this one needs the as while the on method dosnt
        return builder as RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P>;
    }

    group<T extends Path>(
        path: T
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P> {
        const groupBuilder = new RouteGroupBuilder<JoinPaths<R, T>, P>(
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

        for (const route of routes) {
            route.middleware.push(...this.middleware);
        }

        return routes;
    }
}
