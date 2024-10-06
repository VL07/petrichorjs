import { throwUnparseableError, UnparseableError } from "../error.js";
import { Route } from "../route.js";
import { Method } from "./router.js";
import { ParserFunction } from "../types/parser.js";
import { Path } from "../types/path.js";
import { Router } from "./router.js";

type DynamicRoute = {
    parserFunction: ParserFunction<string | undefined> | undefined;
    slugName: string;
    routerNode: TrieRouterNode;
};

type WildcardRoute = {
    parserFunction: ParserFunction<string | undefined> | undefined;
    routes: Map<Method, Route>;
    wildcardMethodRoute: Route | undefined;
};

class TrieRouterNode {
    private staticRouteChildren = new Map<string, TrieRouterNode>();
    private dynamicRequiredRouteChildren: DynamicRoute[] = [];
    private dynamicOptionalRouteChildren: DynamicRoute[] = [];
    private directChildren = new Map<Method, Route>();
    private directChildWildcardMethod: Route | undefined;
    private optionalWildcardRoutes: WildcardRoute[] = [];
    private requiredWildcardRoutes: WildcardRoute[] = [];

    private splitFirstPathSlug(path: Path): [string, Path | undefined] {
        let i = 1;
        while (i < path.length && path[i] !== "/") i++;

        const slug = path.slice(1, i);
        const rest = path.slice(i) as Path;

        return [slug, rest === "/" || !rest ? undefined : rest];
    }

    private isDynamicSlug(slug: string): boolean {
        return slug.startsWith(":");
    }

    private isWildcardSlug(slug: string): boolean {
        return slug === "*" || slug === "*?";
    }

    private isOptionalSlug(slug: string): boolean {
        return slug.endsWith("?");
    }

    private getDynamicSlugName(slug: string): string {
        return slug.slice(1, this.isOptionalSlug(slug) ? -1 : undefined);
    }

    addRoute(route: Route, path: Path): void {
        const [slug, rest] = this.splitFirstPathSlug(path);

        let node: TrieRouterNode;
        if (this.isDynamicSlug(slug)) {
            const slugName = this.getDynamicSlugName(slug);
            const isOptional = this.isOptionalSlug(slug);

            const parserFunction = (
                route.parsers as Record<
                    string,
                    ParserFunction<string | undefined>
                >
            )[slugName];

            const dynamicRouteNode = isOptional
                ? this.getOrCreateOptionalDynamicRouteNode(slug, parserFunction)
                : this.getOrCreateRequiredDynamicRouteNode(
                      slug,
                      parserFunction
                  );
            node = dynamicRouteNode.routerNode;
        } else if (this.isWildcardSlug(slug)) {
            console.log(slug, rest);
            if (rest) throw "Wildcard routes cannot be followed!";

            this.setWildcardRoute(slug, route);

            return;
        } else {
            const staticRouteNode = this.getOrCreateStaticRouteNode(slug);
            node = staticRouteNode;
        }

        if (rest) {
            node.addRoute(route, rest);

            return;
        }

        node.addDirectRoute(route);
    }

    private addDirectRoute(route: Route) {
        const method = route.method;

        if (method === null) {
            if (this.directChildWildcardMethod)
                throw "Only one wildcard method route per path!";
            this.directChildWildcardMethod = route;

            return;
        }

        if (this.directChildren.get(method)) throw "Only one route per method!";
        this.directChildren.set(method, route);
    }

    private getOrCreateStaticRouteNode(slug: string): TrieRouterNode {
        const existing = this.staticRouteChildren.get(slug);
        if (existing) return existing;

        const created = new TrieRouterNode();
        this.staticRouteChildren.set(slug, created);

        return created;
    }

    private getOrCreateRequiredDynamicRouteNode(
        slug: string,
        parserFunction: ParserFunction<string | undefined> | undefined
    ): DynamicRoute {
        const slugName = this.getDynamicSlugName(slug);
        const existing = this.dynamicRequiredRouteChildren.find(
            (child) => child.slugName === slugName
        );
        if (existing && existing.parserFunction === parserFunction)
            return existing;

        const created: DynamicRoute = {
            parserFunction: parserFunction,
            slugName: this.getDynamicSlugName(slug),
            routerNode: new TrieRouterNode(),
        };
        this.dynamicRequiredRouteChildren.push(created);

        return created;
    }

    private getOrCreateOptionalDynamicRouteNode(
        slug: string,
        parserFunction: ParserFunction<string | undefined> | undefined
    ): DynamicRoute {
        const slugName = this.getDynamicSlugName(slug);
        const existing = this.dynamicOptionalRouteChildren.find(
            (child) => child.slugName === slugName
        );
        if (existing && existing.parserFunction === parserFunction)
            return existing;

        const created: DynamicRoute = {
            parserFunction: parserFunction,
            slugName: this.getDynamicSlugName(slug),
            routerNode: new TrieRouterNode(),
        };
        this.dynamicOptionalRouteChildren.push(created);

        return created;
    }

    private setWildcardRoute(slug: string, route: Route): void {
        const isOptional = this.isOptionalSlug(slug);
        const isWildcardMethod = route.method === null;
        const parserFunction = (
            route.parsers as Record<string, ParserFunction<string | undefined>>
        )["wildcard"];

        let existing: WildcardRoute;

        if (isOptional) {
            const localExisting = this.optionalWildcardRoutes.find(
                (route) => route.parserFunction === parserFunction
            );

            if (!localExisting) {
                this.optionalWildcardRoutes.push({
                    parserFunction: parserFunction,
                    routes: !isWildcardMethod
                        ? new Map([[route.method, route]])
                        : new Map(),
                    wildcardMethodRoute: isWildcardMethod ? route : undefined,
                });

                return;
            }

            existing = localExisting;
        } else {
            const localExisting = this.requiredWildcardRoutes.find(
                (route) => route.parserFunction === parserFunction
            );

            if (!localExisting) {
                this.requiredWildcardRoutes.push({
                    parserFunction: parserFunction,
                    routes: !isWildcardMethod
                        ? new Map([[route.method, route]])
                        : new Map(),
                    wildcardMethodRoute: isWildcardMethod ? route : undefined,
                });

                return;
            }

            existing = localExisting;
        }

        if (!isWildcardMethod && existing.routes.get(route.method)) {
            throw "Wildcard routes with same paths and methods are not allowed!";
        } else if (existing.wildcardMethodRoute) {
            throw "Only one wildcard method route per path!";
        }

        if (!isWildcardMethod) {
            existing.routes.set(route.method, route);
        } else {
            existing.wildcardMethodRoute = route;
        }
    }

    getRoute(
        path: Path | undefined,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        if (!path) {
            return (
                this.getDirectRoute(method) ||
                this.getDynamicOptionalRoute(undefined, undefined, method) ||
                this.getOptionalWildcardRoute(undefined, method)
            );
        }

        const [slug, rest] = this.splitFirstPathSlug(path);

        return (
            this.getStaticRoute(slug, rest, method) ||
            this.getDynamicRequiredRoute(slug, rest, method) ||
            this.getDynamicOptionalRoute(slug, rest, method) ||
            this.getRequiredWildcardRoute(path, method) ||
            this.getOptionalWildcardRoute(path, method)
        );
    }

    private getDirectRoute(
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        const matchingMethodRoute = this.directChildren.get(method);
        if (matchingMethodRoute) {
            return [matchingMethodRoute, {}];
        }

        const methodWildcardRoute = this.directChildWildcardMethod;
        if (methodWildcardRoute) {
            return [methodWildcardRoute, {}];
        }

        return undefined;
    }

    private getStaticRoute(
        slug: string,
        rest: Path | undefined,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        const staticNode = this.staticRouteChildren.get(slug);
        if (!staticNode) {
            return undefined;
        }

        return staticNode.getRoute(rest, method);
    }

    private getDynamicRequiredRoute(
        slug: string,
        rest: Path | undefined,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        for (const node of this.dynamicRequiredRouteChildren) {
            const [success, parsedParam] = this.parseParser(
                node.parserFunction,
                slug,
                node.slugName
            );
            if (!success) continue;

            const foundRoute = node.routerNode.getRoute(rest, method);
            if (foundRoute) {
                return [
                    foundRoute[0],
                    {
                        ...foundRoute[1],
                        [node.slugName]: parsedParam,
                    },
                ];
            }
        }

        return undefined;
    }

    private getDynamicOptionalRoute(
        slug: string | undefined,
        rest: Path | undefined,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        for (const node of this.dynamicOptionalRouteChildren) {
            const [success, parsedParam] = this.parseParser(
                node.parserFunction,
                slug,
                node.slugName
            );
            if (!success) continue;

            const foundRoute = node.routerNode.getRoute(rest, method);
            if (foundRoute) {
                return [
                    foundRoute[0],
                    {
                        ...foundRoute[1],
                        [node.slugName]: parsedParam,
                    },
                ];
            }
        }

        return undefined;
    }

    private getRequiredWildcardRoute(
        path: Path,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        for (const node of this.requiredWildcardRoutes) {
            const [success, parsedParam] = this.parseParser(
                node.parserFunction,
                path,
                "wildcard"
            );
            if (!success) continue;

            const route = node.routes.get(method) || node.wildcardMethodRoute;
            if (!route) continue;

            return [
                route,
                {
                    wildcard: parsedParam,
                },
            ];
        }

        return undefined;
    }

    private getOptionalWildcardRoute(
        path: Path | undefined,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        for (const node of this.optionalWildcardRoutes) {
            const [success, parsedParam] = this.parseParser(
                node.parserFunction,
                path,
                "wildcard"
            );
            if (!success) continue;

            let route = node.routes.get(method) || node.wildcardMethodRoute;
            if (!route) continue;

            return [
                route,
                {
                    wildcard: parsedParam,
                },
            ];
        }

        return undefined;
    }

    private parseParser(
        parserFunction: ParserFunction<string | undefined> | undefined,
        param: string | undefined,
        paramName: string
    ): [true, unknown] | [false, undefined] {
        if (!parserFunction) {
            return [true, param];
        }

        try {
            const parsed = parserFunction({
                param: param,
                unparseable: () => throwUnparseableError(paramName),
            });

            return [true, parsed];
        } catch (err) {
            if (err instanceof UnparseableError) {
                return [false, undefined];
            }

            throw err;
        }
    }
}

export class TrieRouter extends Router {
    private baseNode: TrieRouterNode;

    constructor() {
        super();

        this.baseNode = new TrieRouterNode();
    }

    override setRoute(path: Path, route: Route): void {
        this.baseNode.addRoute(route, path);
    }

    override getRoute(
        path: Path,
        method: Method
    ): [Route, Record<string, unknown>] | undefined {
        return this.baseNode.getRoute(path, method);
    }
}

