import {
    BuildableToRoutes,
    ParserFunction,
    RouteBuilder,
    RouteBuilderAllMethods,
    RouteBuilderUnparsed,
    RouteBuilderUnparsedAllMethods,
    RouteGroupBuilder,
    RouteGroupBuilderUnparsed,
} from "./builders.js";
import { Route } from "./route.js";
import { Server } from "./server.js";

// import { Server } from "./server.js";

/*
 * > Order of route execution:
 * 1. Static routes
 * 2. Required dynamic parameters (Parser must not return undefined)
 * 3. Optional dynamic parameters (Parser must not return undefined)
 * 4. Required wildcards
 * 5. Optional wildcards
 *
 * > Example:
 * Routes:
 * 1. GET "/users/:id/"
 * 2. GET "/users/:id/comments/:id"
 * 2. GET "/users/:id/*"
 *
 * GET "/users/123/" will match route .1
 * GET "/users/123/comments/456" will match route .2
 * GET "/users/123/abc" will match route .3
 */

export type Path = `/${string}`;
export type Method = "GET" | "POST" | "PUT" | "DELETE" | string;
export type Body = unknown;

interface DynamicRoute {
    dynamicSlugVariableName: string;
    parser: ParserFunction<string | undefined> | undefined;
    routeGroup: RouteGroup;
}

interface WildcardRoute {
    parser: ParserFunction<string | undefined> | undefined;
    route: Route;
}

export class RouteGroup {
    /** The path so far to this group */
    private readonly path: Path;

    private readonly staticChildGroups: Map<Method, Map<string, RouteGroup>>;
    private readonly staticChildGroupsMethodWildcard: Map<string, RouteGroup>;
    private readonly dynamicChildGroups: Map<
        Method,
        { required: DynamicRoute[]; optional: DynamicRoute[] }
    >;
    private readonly dynamicChildGroupsMethodWildcard: {
        required: DynamicRoute[];
        optional: DynamicRoute[];
    };
    private readonly wildcardChildRoutes: Map<
        Method,
        {
            required: WildcardRoute | undefined;
            optional: WildcardRoute | undefined;
        }
    >;
    private readonly wildcardChildRoutesMethodWildcard: {
        required: WildcardRoute | undefined;
        optional: WildcardRoute | undefined;
    };
    private readonly routes: Map<Method, Route>;
    private routeMethodWildcard: Route | undefined;

    constructor(path: Path) {
        this.path = path;

        this.staticChildGroups = new Map();
        this.staticChildGroupsMethodWildcard = new Map();
        this.dynamicChildGroups = new Map();
        this.dynamicChildGroupsMethodWildcard = {
            required: [],
            optional: [],
        };
        this.wildcardChildRoutes = new Map();
        this.wildcardChildRoutesMethodWildcard = {
            required: undefined,
            optional: undefined,
        };
        this.routes = new Map();
        this.routeMethodWildcard = undefined;
    }

    private getFirstSlugOfPath(path: Path): string {
        let i = 1;
        while (i < path.length && path[i] !== "/") i++;

        return path.slice(1, i);
    }

    private addRoute(route: Route): void {
        if (route.method === null) {
            if (this.routeMethodWildcard)
                throw "Only one method wildcard route per path!";

            this.routeMethodWildcard = route;

            return;
        }

        let existingMethod = this.routes.get(route.method);
        if (existingMethod)
            throw "Only one route per path and method can be created!";

        this.routes.set(route.method, route);
    }

    makeRouteGroupsForPath(path: Path, route: Route): void {
        const slug = this.getFirstSlugOfPath(path);
        if (slug === "") {
            this.addRoute(route);
        } else if (slug.startsWith(":")) {
            const isOptional = slug.endsWith("?");
            const dynamicSlugVariableName = slug.slice(
                1,
                isOptional ? -1 : undefined
            );

            let existingMethod =
                route.method && this.dynamicChildGroups.get(route.method);
            if (route.method !== null && existingMethod === undefined) {
                existingMethod = {
                    required: [],
                    optional: [],
                };
                this.dynamicChildGroups.set(route.method, existingMethod);
            }

            const dynamicChildRouteGroup = new RouteGroup(
                `${this.path}/${slug}`
            );

            dynamicChildRouteGroup.makeRouteGroupsForPath(
                `/${path.slice(slug.length + 2)}`,
                route
            );

            const parsers = route.parsers as Record<
                string,
                ParserFunction<string | undefined>
            >;
            const dynamicRoute = {
                dynamicSlugVariableName: dynamicSlugVariableName,
                parser: parsers[dynamicSlugVariableName],
                routeGroup: dynamicChildRouteGroup,
            } satisfies DynamicRoute;

            if (!existingMethod) {
                if (isOptional) {
                    this.dynamicChildGroupsMethodWildcard.optional.push(
                        dynamicRoute
                    );
                } else {
                    this.dynamicChildGroupsMethodWildcard.required.push(
                        dynamicRoute
                    );
                }
            } else {
                if (isOptional) {
                    existingMethod.optional.push(dynamicRoute);
                } else {
                    existingMethod.required.push(dynamicRoute);
                }
            }
        } else if (slug === "*" || slug === "*?") {
            const isOptional = slug.endsWith("?");
            let existingMethod =
                route.method && this.wildcardChildRoutes.get(route.method);
            if (route.method !== null && existingMethod === undefined) {
                existingMethod = {
                    required: undefined,
                    optional: undefined,
                };
                this.wildcardChildRoutes.set(route.method, existingMethod);
            }

            const parsers = route.parsers as Record<
                string,
                ParserFunction<string | undefined>
            >;
            const parser = parsers.wildcard;
            if (existingMethod) {
                if (isOptional) {
                    if (existingMethod.optional)
                        throw "Only one optional wildcard per route and method!";

                    existingMethod.optional = {
                        parser: parser,
                        route: route,
                    };
                } else {
                    if (existingMethod.required)
                        throw "Only one required wildcard per route and method!";

                    existingMethod.required = {
                        parser: parser,
                        route: route,
                    };
                }
            } else {
                if (isOptional) {
                    if (this.wildcardChildRoutesMethodWildcard.optional)
                        throw "Only one optional wildcard per route and method!";

                    this.wildcardChildRoutesMethodWildcard.optional = {
                        parser: parser,
                        route: route,
                    };
                } else {
                    if (this.wildcardChildRoutesMethodWildcard.required)
                        throw "Only one required wildcard per route and method!";

                    this.wildcardChildRoutesMethodWildcard.required = {
                        parser: parser,
                        route: route,
                    };
                }
            }
        } else if (route.method === null) {
            let existingRouteGroup =
                this.staticChildGroupsMethodWildcard.get(slug);
            if (!existingRouteGroup) {
                existingRouteGroup = new RouteGroup(`${this.path}/${slug}`);
                this.staticChildGroupsMethodWildcard.set(
                    slug,
                    existingRouteGroup
                );
            }

            existingRouteGroup.makeRouteGroupsForPath(
                `/${path.slice(slug.length + 2)}`,
                route
            );
        } else {
            let existingMethod = this.staticChildGroups.get(route.method);
            if (!existingMethod) {
                existingMethod = new Map();
                this.staticChildGroups.set(route.method, existingMethod);
            }

            let existingRouteGroup = existingMethod.get(slug);
            if (!existingRouteGroup) {
                existingRouteGroup = new RouteGroup(`${this.path}/${slug}`);
                existingMethod.set(slug, existingRouteGroup);
            }

            existingRouteGroup.makeRouteGroupsForPath(
                `/${path.slice(slug.length + 2)}`,
                route
            );
        }
    }

    getRouteFromPath(
        path: Path,
        method: Method
    ): { route: Route; params: Record<string, any> } | undefined {
        const slug = this.getFirstSlugOfPath(path);

        if (slug === "") {
            const route = this.routes.get(method) || this.routeMethodWildcard;
            if (route) {
                return {
                    route: route,
                    params: {},
                };
            }

            const optionalDynamicRouteMetod =
                this.dynamicChildGroups.get(method) ||
                this.dynamicChildGroupsMethodWildcard;
            if (optionalDynamicRouteMetod) {
                for (const optionalDynamicRoute of optionalDynamicRouteMetod.optional) {
                    const parsed = optionalDynamicRoute.parser
                        ? optionalDynamicRoute.parser(undefined)
                        : undefined;
                    if (parsed === null) continue;

                    const route =
                        optionalDynamicRoute.routeGroup.getRouteFromPath(
                            "/",
                            method
                        );
                    if (!route) continue;

                    route.params[optionalDynamicRoute.dynamicSlugVariableName] =
                        parsed;
                    return route;
                }
            }

            const optionalWildcardRoute = (
                this.wildcardChildRoutes.get(method) ||
                this.wildcardChildRoutesMethodWildcard
            )?.optional;
            if (optionalWildcardRoute) {
                const parsed = optionalWildcardRoute.parser
                    ? optionalWildcardRoute.parser(undefined)
                    : undefined;
                if (parsed === null) return undefined;

                return {
                    params: { wildcard: parsed },
                    route: optionalWildcardRoute.route,
                };
            }

            return undefined;
        }

        const restPath = `/${path.slice(slug.length + 2)}` as Path;

        const staticChildRoute = this.getRouteFromStaticChildGroup(
            slug,
            restPath,
            method
        );
        if (staticChildRoute) return staticChildRoute;

        const dynamicChildRoute = this.getRouteFromDynamicChildGroup(
            slug,
            restPath,
            method
        );
        if (dynamicChildRoute) return dynamicChildRoute;

        const wildcardRoute = this.getRouteFromWildcardChildGroup(path, method);
        if (wildcardRoute) return wildcardRoute;

        return undefined;
    }

    private getRouteFromStaticChildGroup(
        slug: string,
        restPath: Path,
        method: Method
    ): { route: Route; params: Record<string, any> } | undefined {
        const staticChildGroupsMethod =
            this.staticChildGroups.get(method) ||
            this.staticChildGroupsMethodWildcard;
        if (!staticChildGroupsMethod) return undefined;

        const staticChildGroup = staticChildGroupsMethod.get(slug);
        if (!staticChildGroup) return undefined;

        return staticChildGroup.getRouteFromPath(restPath, method);
    }

    private getRouteFromDynamicChildGroup(
        slug: string,
        restPath: Path,
        method: Method
    ): { route: Route; params: Record<string, any> } | undefined {
        const dynamicChildGroupsMethod =
            this.dynamicChildGroups.get(method) ||
            this.dynamicChildGroupsMethodWildcard;
        if (!dynamicChildGroupsMethod) return undefined;

        for (const dynamicRouteGroup of dynamicChildGroupsMethod.required) {
            const parsed = dynamicRouteGroup.parser
                ? dynamicRouteGroup.parser(slug)
                : slug;
            if (parsed === null) continue;

            const route = dynamicRouteGroup.routeGroup.getRouteFromPath(
                restPath,
                method
            );
            if (!route) continue;

            route.params[dynamicRouteGroup.dynamicSlugVariableName] = parsed;
            return route;
        }

        for (const dynamicRouteGroup of dynamicChildGroupsMethod.optional) {
            const parsed = dynamicRouteGroup.parser
                ? dynamicRouteGroup.parser(slug)
                : slug;
            if (parsed === null) continue;

            const route = dynamicRouteGroup.routeGroup.getRouteFromPath(
                restPath,
                method
            );
            if (!route) continue;

            route.params[dynamicRouteGroup.dynamicSlugVariableName] = parsed;
            return route;
        }

        return undefined;
    }

    private getRouteFromWildcardChildGroup(
        path: Path,
        method: Method
    ): { route: Route; params: Record<string, any> } | undefined {
        const wildcardChildGroupsMethod =
            this.wildcardChildRoutes.get(method) ||
            this.wildcardChildRoutesMethodWildcard;
        if (!wildcardChildGroupsMethod) return undefined;

        const requiredWildcardRoute = wildcardChildGroupsMethod.required;
        if (requiredWildcardRoute) {
            const parsed = requiredWildcardRoute?.parser
                ? requiredWildcardRoute.parser(path)
                : path;
            if (parsed !== undefined) {
                return {
                    params: { wildcard: parsed },
                    route: requiredWildcardRoute.route,
                };
            }
        }

        const optionalWildcardRoute = wildcardChildGroupsMethod.optional;
        if (optionalWildcardRoute) {
            const parsed = optionalWildcardRoute?.parser
                ? optionalWildcardRoute.parser(path)
                : path;
            if (parsed !== undefined) {
                return {
                    params: { wildcard: parsed },
                    route: optionalWildcardRoute.route,
                };
            }
        }

        return undefined;
    }
}

export class Router {
    private readonly routeBuilders: BuildableToRoutes[] = [];
    private readonly groupBuilders: BuildableToRoutes[] = [];

    constructor() {}

    get<R extends Path>(route: R): RouteBuilderUnparsed<R, ["GET"], {}> {
        return this.on("GET", route);
    }

    post<R extends Path>(route: R): RouteBuilderUnparsed<R, ["POST"], {}> {
        return this.on("POST", route);
    }

    put<R extends Path>(route: R): RouteBuilderUnparsed<R, ["PUT"], {}> {
        return this.on("PUT", route);
    }

    delete<R extends Path>(route: R): RouteBuilderUnparsed<R, ["DELETE"], {}> {
        return this.on("DELETE", route);
    }

    on<M extends Method, R extends Path>(
        method: M,
        route: R
    ): RouteBuilderUnparsed<R, [M], {}> {
        const builder = new RouteBuilder<R, [M], {}>(route, [method]);
        this.routeBuilders.push(builder);

        return builder;
    }

    all<R extends Path>(route: R): RouteBuilderUnparsedAllMethods<R, {}> {
        const builder = new RouteBuilderAllMethods<R, {}>(route);
        this.routeBuilders.push(builder);

        return builder;
    }

    group<R extends Path>(path: R): RouteGroupBuilderUnparsed<R, {}> {
        const builder = new RouteGroupBuilder<R, {}>(path);
        this.groupBuilders.push(builder);

        return builder;
    }

    private buildRouteBuilders(): RouteGroup {
        const parentRouteGroup = new RouteGroup("/");

        for (const builder of this.routeBuilders) {
            for (const route of builder.build()) {
                parentRouteGroup.makeRouteGroupsForPath(route.path, route);
            }
        }

        for (const builder of this.groupBuilders) {
            for (const route of builder.build()) {
                parentRouteGroup.makeRouteGroupsForPath(route.path, route);
            }
        }

        return parentRouteGroup;
    }

    listen(port: number): void {
        const routes = this.buildRouteBuilders();
        const server = new Server(routes, "localhost", port);
        server.listen();
    }
}
