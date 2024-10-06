import { RouteBuilderContext } from "../builders/context.js";
import { BuildableToRoutes } from "../builders/index.js";
import { RouteBuilder, RouteBuilderUnparsed } from "../builders/route.js";
import {
    RouteBuilderAllMethods,
    RouteBuilderUnparsedAllMethods,
} from "../builders/routeAllMethods.js";
import {
    RouteGroupBuilder,
    RouteGroupBuilderUnparsed,
} from "../builders/routeGroup.js";
import {
    BeforeFunction,
    JoinLocals,
    Locals,
    Middleware,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Route } from "../route.js";
import { ServerOptions, UseServerFunction } from "../server/server.js";
import { Mix } from "../types/common.js";
import { Path } from "../types/path.js";
import { AutocompletePath, CheckPath, PathError } from "../types/pathCheck.js";

/**
 * Http methods. All strings are allowed to support custom methods, but non
 * standard ones don't have shorthand methods.
 */
export type Method = "GET" | "POST" | "PUT" | "DELETE" | string;
export type Body = unknown;

/**
 * Handles the incomming requests and finds a route that matches
 *
 * The order of what route gets selected is as follows:
 *
 * 1. Static routes: `/users/me` or `/`
 * 2. Dynamic routes: `/users/:id`
 * 3. Optional dynamic routes: `/users/:id?`
 * 4. Wildcard routes: `/users/*`
 * 5. Optional wildcard routes: `/users/*?`
 *
 * The method order:
 *
 * 1. Explicit methods: `router.get`, `router.post` or `router.on`
 * 2. Wildcard methods: `router.all`
 *
 * Note that the parsers also have to match for the dynamic routes.
 *
 * Creating routes can be done by either using the `on` or using one of the
 * shorthand methods method:
 *
 * ```ts
 * router.on("GET", "/users/:id").handle(({ request, response }) => {});
 * router.get("/users/:id").handle(({ request, response }) => {});
 * ```
 */
export abstract class Router<L extends Locals = NonNullable<unknown>> {
    private readonly routeBuilders: BuildableToRoutes[] = [];
    private readonly groupBuilders: BuildableToRoutes[] = [];
    private middleware: MiddlewareOrBefore[] = [];

    constructor() {}

    /** Set a route on the router @internal */
    abstract setRoute(path: Path, route: Route): void;

    /**
     * Get a route, and the parsed params, from a path and method. Returns
     * `undefined` if no route could be found.
     *
     * @internal
     */
    abstract getRoute(
        path: Path,
        method: Method
    ): [Route, Record<string, unknown>] | undefined;

    /** Handle `get` requests. Shorthand for the `router.on("GET", ...)` method. */
    get<R extends Path>(
        route: CheckPath<R> extends PathError
            ? CheckPath<R> | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteBuilderUnparsed<RouteBuilderContext<R, ["GET"]>> {
        return this.on("GET", route);
    }

    /**
     * Handle `post` requests. Shorthand for the `router.on("POST", ...)`
     * method.
     */
    post<R extends Path>(
        route: CheckPath<R> extends PathError
            ? CheckPath<R> | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteBuilderUnparsed<RouteBuilderContext<R, ["POST"]>> {
        return this.on("POST", route);
    }

    /** Handle `put` requests. Shorthand for the `router.on("PUT", ...)` method. */
    put<R extends Path>(
        route: CheckPath<R> extends PathError
            ? CheckPath<R> | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteBuilderUnparsed<RouteBuilderContext<R, ["PUT"]>> {
        return this.on("PUT", route);
    }

    /**
     * Handle `delete` requests. Shorthand for the `router.on("GET", ...)`
     * method.
     */
    delete<R extends Path>(
        route: CheckPath<R> extends PathError
            ? CheckPath<R> | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteBuilderUnparsed<RouteBuilderContext<R, ["DELETE"]>> {
        return this.on("DELETE", route);
    }

    /**
     * Creates a route builder for the specified method. For all regular methods
     * you can also use shorthand methods: `get`, `post`, `put` and `delete`
     *
     * @example
     *     // Creates a get handler for the `/users/:id` route
     *     // Is also the same as doing router.get("/users/:id")
     *     router.on("GET", "/users/:id").handle(({request, response}) => {
     *     ...
     *     })
     */
    on<M extends Method, R extends Path>(
        method: M,
        route: CheckPath<R> extends PathError
            ? CheckPath<R> | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteBuilderUnparsed<RouteBuilderContext<R, [M]>> {
        const builder = new RouteBuilder<RouteBuilderContext<R, [M]>>(
            route as R,
            [method]
        );
        this.routeBuilders.push(builder);

        return builder;
    }

    /**
     * Simmilar to the on method, but catches all methods. It will only be ran
     * if no other routes with matching methods was found. Therefor it can be
     * used to create custom `404` routes.
     *
     * @example
     *     router.all("/*?").handle(({ request, response }) => {
     *         console.log(request.params.wildcard);
     *     });
     */
    all<R extends Path>(
        route: CheckPath<R> extends PathError
            ? CheckPath<R> | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteBuilderUnparsedAllMethods<RouteBuilderContext<R>> {
        const builder = new RouteBuilderAllMethods<RouteBuilderContext<R>>(
            route as R
        );
        this.routeBuilders.push(builder);

        return builder;
    }

    /**
     * Middleware is a function that gets called before the request gets handled
     * by the handler, it has access to the request, response and calling the
     * next handler method. The middleware to be created first will execute
     * first on incomming requests. For the next middleware and eventually the
     * route handler to be executed the `next` function has to be called. The
     * `next` function dosn't return anything but it might mutate the `response`
     * object depending on what the next middleware or the request handler
     * does.
     *
     * @example
     *     router.use(async ({ request, response }, next) => {
     *         console.log("Started middleware");
     *         await next();
     *         console.log("Ended middleware");
     *     });
     */
    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    /**
     * A middleware that only has access to the request and runs before the
     * route is handled. It can change request `locals` by returning a object of
     * the `locals`. It can also end requests early by throwing a HttpError
     * which will later populate the response. **Always assign the router
     * valiable after using this or the type checking won't work as expected!**
     *
     * @example
     *     const router = new Router().before(async (request) => {
     *         const user = await getUser(request);
     *         if (!user) throw new HttpError(401, "Unauthorized");
     *
     *         return {
     *             user: user,
     *         };
     *     });
     *     router.get("/").handle(({ request, response }) => {
     *         console.log(request.locals); // { user: User }
     *     });
     */
    before<
        T extends BeforeFunction<
            "/",
            NonNullable<unknown>,
            NonNullable<unknown>
        >,
    >(beforeFunction: T): Router<JoinLocals<"/", T, L, NonNullable<unknown>>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction,
        });

        return this as Router<JoinLocals<"/", T, L, NonNullable<unknown>>>;
    }

    /**
     * Create a group of routes. The path can include dynamic paths and they can
     * be parsed using the `parse` function before calling `handle`
     *
     * @example
     *     const userGroup = router.group("/users/:id").handle()
     *     userGroup.get("/").handle(...) // Will handle get requests to /users/:id
     *
     * @example
     *     // Parse the id with the intParser
     *     const userGroup = router
     *         .group("/users/:id")
     *         .parse({
     *             id: intParser,
     *         })
     *         .handle();
     */
    group<R extends Path>(
        path: CheckPath<R> extends PathError
            ? (PathError & CheckPath<R>) | NoInfer<AutocompletePath<R>>
            : NoInfer<R | AutocompletePath<R>>
    ): RouteGroupBuilderUnparsed<RouteBuilderContext<R>> {
        const builder = new RouteGroupBuilder<RouteBuilderContext<R>>(
            path as R
        );
        this.groupBuilders.push(builder);

        return builder;
    }

    private buildRouteBuilders(): void {
        for (const builder of this.routeBuilders) {
            for (const route of builder.build()) {
                route.middleware = [
                    ...this.middleware,
                    ...route.middleware,
                ].reverse();

                this.setRoute(route.path, route);
            }
        }

        for (const builder of this.groupBuilders) {
            for (const route of builder.build()) {
                route.middleware = [
                    ...this.middleware,
                    ...route.middleware,
                ].reverse();

                this.setRoute(route.path, route);
            }
        }
    }

    /**
     * Listen for requests on the specified port. This method should be called
     * after all routes have been registerd because this method never returns.
     *
     * @example
     *     const router = new Router();
     *     router.get("/").handle(({ request, response }) => {
     *         response.html("<h1>Hello World!</h1>");
     *     });
     *     router.listen(8000);
     *     // GET http://localhost:8000 => Hello World!
     */
    listen(
        port: number,
        server: UseServerFunction,
        options?: Mix<Omit<ServerOptions, "port">>
    ): void {
        this.buildRouteBuilders();
        const createdServer = server(this, this.middleware.slice().reverse(), {
            ...options,
            port: port,
        });

        createdServer.listen();
    }
}

