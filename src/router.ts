import { Route } from "./route.js";
import {
    RouteBuilderUnparsed,
    RouteBuilderUnparsedBackend,
} from "./routeBuilder.js";
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

interface RouteGroup {
    childGroups: Map<string, RouteGroup>;
    childDynamicRoutes: {
        isOptional: boolean;
        slug: string;
        group: RouteGroup;
    }[];
    childWildCardRoutes: Map<
        Method,
        {
            isOptional: boolean;
            route: Route;
        }
    >;
    childRoutes: Map<Method, Route>;
}

type Slug = {
    builder: RouteBuilderUnparsedBackend<Path, Method>;
    slugs: (
        | {
              isDynamic: false;
              isWildcard: false;
              slugName: string;
          }
        | {
              isDynamic: true;
              isWildcard: false;
              isOptional: boolean;
              dynamicSlugName: string;
          }
        | {
              isDynamic: false;
              isWildcard: true;
              isOptional: boolean;
          }
    )[];
};

export class Router {
    private readonly routeBuilders: RouteBuilderUnparsedBackend<
        Path,
        Method
    >[] = [];

    constructor() {}

    GET<R extends Path>(route: R): RouteBuilderUnparsed<R, "GET"> {
        const builderBackend = new RouteBuilderUnparsedBackend<R, "GET">(
            route,
            "GET"
        );
        this.routeBuilders.push(builderBackend);

        return new RouteBuilderUnparsed(builderBackend, route, "GET");
    }

    POST<R extends Path>(route: R): RouteBuilderUnparsed<R, "POST"> {
        const builderBackend = new RouteBuilderUnparsedBackend<R, "POST">(
            route,
            "POST"
        );
        this.routeBuilders.push(builderBackend);

        return new RouteBuilderUnparsed(builderBackend, route, "POST");
    }

    private routeBuilderToSlugs(
        builder: RouteBuilderUnparsedBackend<Path, Method>
    ): Slug {
        const slugs: Slug = {
            builder: builder,
            slugs: [],
        };

        const slugNames =
            builder.route.slice(1) === ""
                ? []
                : builder.route.slice(1).split("/");
        console.log(
            slugNames,
            builder.route,
            builder.route.slice(1),
            builder.route.slice(1).split("/")
        );
        for (const [i, slugName] of slugNames.entries()) {
            if (slugName === "*") {
                if (i !== slugNames.length - 1)
                    throw "Wildcard routes has to be put at end of route path!";

                slugs.slugs.push({
                    isDynamic: false,
                    isWildcard: true,
                    isOptional: false,
                });
            } else if (slugName === "*?") {
                if (i !== slugNames.length - 1)
                    throw "Wildcard routes has to be put at end of route path!";

                slugs.slugs.push({
                    isDynamic: false,
                    isWildcard: true,
                    isOptional: true,
                });
            } else if (slugName.startsWith(":")) {
                const isOptional = slugName.endsWith("?");

                if (isOptional && i !== slugNames.length - 1)
                    throw "Optional routes has to be put at end of route path!";

                slugs.slugs.push({
                    isDynamic: true,
                    isWildcard: false,
                    isOptional: isOptional,
                    dynamicSlugName: slugName.slice(
                        1,
                        isOptional ? -1 : undefined
                    ),
                });
            } else {
                slugs.slugs.push({
                    isDynamic: false,
                    isWildcard: false,
                    slugName: slugName,
                });
            }
        }

        return slugs;
    }

    private setRouteFromSlugs(baseRouteGroup: RouteGroup, slugs: Slug): void {
        let parentRouteGroup = baseRouteGroup;

        let startedOptionalParams = false;

        for (const slug of slugs.slugs) {
            if (slug.isWildcard) {
                if (
                    parentRouteGroup.childWildCardRoutes.get(
                        slugs.builder.method
                    )
                )
                    throw "Only one wildcard route per route can be made!";

                const route = slugs.builder.build();
                parentRouteGroup.childWildCardRoutes.set(slugs.builder.method, {
                    isOptional: slug.isOptional,
                    route: route,
                });

                return;
            } else if (slug.isDynamic) {
                console.log("dynamic");
                const existing = parentRouteGroup.childDynamicRoutes.find(
                    (route) => route.slug === slug.dynamicSlugName
                );

                if (slug.isOptional) {
                    startedOptionalParams = true;
                } else if (!slug.isOptional && startedOptionalParams) {
                    throw "Optional dynamic routes cannot be followed by required ones!";
                }

                if (!existing) {
                    const childGroup = {
                        childGroups: new Map(),
                        childDynamicRoutes: [],
                        childRoutes: new Map(),
                        childWildCardRoutes: new Map(),
                    } satisfies RouteGroup;

                    parentRouteGroup.childDynamicRoutes.push({
                        isOptional: slug.isOptional,
                        slug: slug.dynamicSlugName,
                        group: childGroup,
                    });

                    parentRouteGroup = childGroup;

                    continue;
                }

                if (existing && existing.isOptional !== slug.isOptional)
                    throw "Optional and required dynamic routes with same name cannot be created";

                parentRouteGroup = existing.group;
            } else {
                const existing = parentRouteGroup.childGroups.get(
                    slug.slugName
                );
                if (!existing) {
                    const childGroup = {
                        childGroups: new Map(),
                        childDynamicRoutes: [],
                        childRoutes: new Map(),
                        childWildCardRoutes: new Map(),
                    } satisfies RouteGroup;

                    parentRouteGroup.childGroups.set(slug.slugName, childGroup);
                    parentRouteGroup = childGroup;

                    continue;
                }

                parentRouteGroup = existing;
            }
        }

        const existingRoute = parentRouteGroup.childRoutes.get(
            slugs.builder.method
        );
        if (existingRoute)
            throw "Only one route per method and path can be created!";

        const route = slugs.builder.build();
        parentRouteGroup.childRoutes.set(slugs.builder.method, route);

        console.dir(baseRouteGroup, { depth: null });
    }

    private buildRouteBuilders(): RouteGroup {
        const routeGroup = {
            childGroups: new Map(),
            childDynamicRoutes: [],
            childRoutes: new Map(),
            childWildCardRoutes: new Map(),
        } satisfies RouteGroup;

        for (const builder of this.routeBuilders) {
            const slugs = this.routeBuilderToSlugs(builder);
            this.setRouteFromSlugs(routeGroup, slugs);
        }

        console.dir(routeGroup, { depth: null });

        return routeGroup;
    }

    listen(port: number): never {
        const routes = this.buildRouteBuilders();
        // const server = new Server(this.routes, port);

        throw "never";
    }
}
