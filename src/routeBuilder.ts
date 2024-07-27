import { HandlerFunction, Parsed, ParserFunctions, Route } from "./route.js";
import type { Method, Path } from "./router.js";

export class RouteBuilderUnparsedMethodWildcard<R extends Path> {
    constructor(
        private readonly backend: RouteBuilderUnparsedMethodWildcardBackend<R>,
        private readonly route: R
    ) {}

    parse<T extends ParserFunctions<R>>(
        parsers: T
    ): RouteBuilderParsed<R, null, T> {
        return this.backend.parse(parsers);
    }

    handle(handler: HandlerFunction<R, Parsed<R, {}>>): void {
        this.backend.handler = handler;
    }
}

export class RouteBuilderUnparsedMethodWildcardBackend<R extends Path> {
    readonly methods = null;

    routeBuilderParsedBackend:
        | RouteBuilderParsedBackend<R, null, any>
        | undefined;
    handler: HandlerFunction<R, Parsed<R, {}>> | undefined;

    constructor(readonly route: R) {}

    parse<T extends ParserFunctions<R>>(
        parsers: T
    ): RouteBuilderParsed<R, null, T> {
        const routeBuilderParsedBackend = new RouteBuilderParsedBackend(
            this.route,
            null,
            parsers
        );

        this.routeBuilderParsedBackend = routeBuilderParsedBackend;

        return new RouteBuilderParsed<R, null, T>(
            routeBuilderParsedBackend,
            this.route,
            null
        );
    }

    build(): Route[] {
        if (this.routeBuilderParsedBackend)
            return this.routeBuilderParsedBackend.build();

        if (!this.handler) throw "All routes has to have a handler!";

        return [new Route(this.route, null, {}, this.handler)];
    }
}

export class RouteBuilderUnparsed<R extends Path, M extends Method[]> {
    constructor(
        private readonly backend: RouteBuilderUnparsedBackend<R, M>,
        private readonly route: R,
        private readonly methods: M
    ) {}

    parse<T extends ParserFunctions<R>>(
        parsers: T
    ): RouteBuilderParsed<R, M, T> {
        return this.backend.parse(parsers);
    }

    get(): RouteBuilderUnparsed<R, [...M, "GET"]> {
        return this.on("GET");
    }

    post(): RouteBuilderUnparsed<R, [...M, "POST"]> {
        return this.on("POST");
    }

    put(): RouteBuilderUnparsed<R, [...M, "PUT"]> {
        return this.on("PUT");
    }

    delete(): RouteBuilderUnparsed<R, [...M, "DELETE"]> {
        return this.on("DELETE");
    }

    on<NM extends Method>(method: NM): RouteBuilderUnparsed<R, [...M, NM]> {
        if (this.backend.methods.find((m) => m === method))
            throw "Can only have one of every method per route!";

        const newBackend = new RouteBuilderUnparsedBackend<R, [...M, NM]>(
            this.route,
            [...this.backend.methods, method]
        );
        this.backend.nextRouteBuilderUnparsedBackend = newBackend;

        const newFrontend = new RouteBuilderUnparsed<R, [...M, NM]>(
            newBackend,
            this.route,
            [...this.backend.methods, method]
        );

        return newFrontend;
    }

    handle(handler: HandlerFunction<R, Parsed<R, {}>>): void {
        this.backend.handler = handler;
    }
}

export class RouteBuilderUnparsedBackend<R extends Path, M extends Method[]> {
    routeBuilderParsedBackend: RouteBuilderParsedBackend<R, M, any> | undefined;
    handler: HandlerFunction<R, Parsed<R, {}>> | undefined;
    nextRouteBuilderUnparsedBackend:
        | RouteBuilderUnparsedBackend<R, Method[]>
        | undefined;

    constructor(
        readonly route: R,
        public methods: M
    ) {}

    parse<T extends ParserFunctions<R>>(
        parsers: T
    ): RouteBuilderParsed<R, M, T> {
        const routeBuilderParsedBackend = new RouteBuilderParsedBackend(
            this.route,
            this.methods,
            parsers
        );

        this.routeBuilderParsedBackend = routeBuilderParsedBackend;

        return new RouteBuilderParsed<R, M, T>(
            routeBuilderParsedBackend,
            this.route,
            this.methods
        );
    }

    build(): Route[] {
        if (this.nextRouteBuilderUnparsedBackend)
            return this.nextRouteBuilderUnparsedBackend.build();
        else if (this.routeBuilderParsedBackend)
            return this.routeBuilderParsedBackend.build();

        if (!this.handler) throw "All routes has to have a handler!";

        const builtRoutes: Route[] = [];
        for (const method of this.methods) {
            new Route(this.route, method, {}, this.handler);
        }

        return builtRoutes;
    }
}

class RouteBuilderParsed<
    R extends Path,
    M extends Method[] | null,
    P extends ParserFunctions<R>,
> {
    constructor(
        private readonly backend: RouteBuilderParsedBackend<R, M, P>,
        private readonly route: R,
        private readonly methods: M
    ) {}

    handle(handler: HandlerFunction<R, Parsed<R, P>>): void {
        this.backend.handler = handler;
    }
}

class RouteBuilderParsedBackend<
    R extends Path,
    M extends Method[] | null,
    P extends ParserFunctions<R>,
> {
    handler: HandlerFunction<R, Parsed<R, P>> | undefined;

    constructor(
        private readonly route: R,
        readonly methods: M,
        readonly parsers: P
    ) {}

    build(): Route[] {
        if (!this.handler) throw "All routes has to have a handler!";

        if (this.methods !== null) {
            const routesBuilt: Route[] = [];
            for (const method of this.methods) {
                routesBuilt.push(
                    new Route(this.route, method, this.parsers, this.handler)
                );
            }

            return routesBuilt;
        }

        return [new Route(this.route, null, this.parsers, this.handler)];
    }
}
