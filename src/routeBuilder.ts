import { HandlerFunction, Parsed, ParserFunctions, Route } from "./route.js";
import type { Method, Path } from "./router.js";

export class RouteBuilderUnparsed<R extends Path, M extends Method | null> {
    constructor(
        private readonly backend: RouteBuilderUnparsedBackend<R, M>,
        private readonly route: R,
        private readonly method: M
    ) {}

    parse<T extends ParserFunctions<R>>(
        parsers: T
    ): RouteBuilderParsed<R, M, T> {
        return this.backend.parse(parsers);
    }

    handle(handler: HandlerFunction<R, Parsed<R, {}>>): void {
        this.backend.handler = handler;
    }
}

export class RouteBuilderUnparsedBackend<
    R extends Path,
    M extends Method | null,
> {
    routeBuilderParsedBackend: RouteBuilderParsedBackend<R, M, any> | undefined;
    handler: HandlerFunction<R, Parsed<R, {}>> | undefined;

    constructor(
        readonly route: R,
        readonly method: M
    ) {}

    parse<T extends ParserFunctions<R>>(
        parsers: T
    ): RouteBuilderParsed<R, M, T> {
        const routeBuilderParsedBackend = new RouteBuilderParsedBackend(
            this.route,
            this.method,
            parsers
        );

        this.routeBuilderParsedBackend = routeBuilderParsedBackend;

        return new RouteBuilderParsed<R, M, T>(
            routeBuilderParsedBackend,
            this.route,
            this.method
        );
    }

    build(): Route {
        if (this.routeBuilderParsedBackend)
            return this.routeBuilderParsedBackend.build();

        if (!this.handler) throw "All routes has to have a handler!";

        return new Route(this.route, this.method, {}, this.handler);
    }
}

class RouteBuilderParsed<
    R extends Path,
    M extends Method | null,
    P extends ParserFunctions<R>,
> {
    constructor(
        private readonly backend: RouteBuilderParsedBackend<R, M, P>,
        private readonly route: R,
        private readonly method: M
    ) {}

    handle(handler: HandlerFunction<R, Parsed<R, P>>): void {}
}

class RouteBuilderParsedBackend<
    R extends Path,
    M extends Method | null,
    P extends ParserFunctions<R>,
> {
    handler: HandlerFunction<R, Parsed<R, P>> | undefined;

    constructor(
        private readonly route: R,
        private readonly method: M,
        readonly parsers: P
    ) {}

    build(): Route {
        if (!this.handler) throw "";

        return new Route(this.route, this.method, this.parsers, this.handler);
    }
}
