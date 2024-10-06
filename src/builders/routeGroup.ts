import {
    BeforeFunction,
    Middleware,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Route } from "../route.js";
import { Method } from "../router/router.js";
import {
    ParsedParsers,
    ParserFunctions,
    ParserFunctionsForPath,
} from "../types/parser.js";
import { JoinPaths, Path } from "../types/path.js";
import { CheckPath, PathError } from "../types/pathCheck.js";
import {
    UnvalidatedFunctions,
    ValidatedFunctions,
    ValidatorFunction,
    Validators,
    ValidatorType,
} from "../validate.js";
import {
    BeforeFunctionRouteBuilderContext,
    GroupOutRouteBuilderContext,
    ParsedRouteBuilderContext,
    RouteBuilderContext,
    ValidateRouteBuilderContext,
} from "./context.js";
import { BuildableToRoutes } from "./index.js";
import { RouteBuilder, RouteBuilderUnparsed } from "./route.js";
import {
    RouteBuilderAllMethods,
    RouteBuilderUnparsedAllMethods,
} from "./routeAllMethods.js";

interface RouteGroupBuilderParsed<C extends RouteBuilderContext> {
    /** @see {@link RouteBuilderParsed.handle} */
    handle(): RouteGroup<C>;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteGroupBuilderParsed<BeforeFunctionRouteBuilderContext<C, T>>;
    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteGroupBuilderParsed<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    >;
}

export interface RouteGroupBuilderUnparsed<C extends RouteBuilderContext>
    extends RouteGroupBuilderParsed<C> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<BeforeFunctionRouteBuilderContext<C, T>>;
    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteGroupBuilderUnparsed<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    >;
    parse<T extends ParserFunctionsForPath<C["path"], C["parsed"]>>(
        parsers: T
    ): RouteGroupBuilderParsed<ParsedRouteBuilderContext<C, ParsedParsers<T>>>;
}

interface RouteGroup<C extends RouteBuilderContext> {
    on<T extends Method, U extends Path>(
        method: T,
        path: CheckPath<JoinPaths<C["path"], U>> extends PathError
            ? CheckPath<JoinPaths<C["path"], U>>
            : U
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, U, [T]>>;

    get<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["GET"]>>;
    post<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["POST"]>>;
    put<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["PUT"]>>;
    delete<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["DELETE"]>>;

    all<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsedAllMethods<
        GroupOutRouteBuilderContext<C, T, unknown>
    >;

    group<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteGroupBuilderUnparsed<GroupOutRouteBuilderContext<C, T, unknown>>;
}

export class RouteGroupBuilder<C extends RouteBuilderContext>
    implements RouteGroupBuilderUnparsed<C>, BuildableToRoutes
{
    parsers: ParserFunctions | undefined;
    routeGroup: RouteGroupBackend<C> | undefined;
    middleware: MiddlewareOrBefore[] = [];

    constructor(readonly path: C["path"]) {}

    parse<T extends ParserFunctionsForPath<C["path"], C["parsed"]>>(
        parsers: T
    ): RouteGroupBuilderParsed<ParsedRouteBuilderContext<C, ParsedParsers<T>>> {
        this.parsers = parsers;
        return this as unknown as RouteGroupBuilderParsed<
            ParsedRouteBuilderContext<C, ParsedParsers<T>>
        >;
    }

    use(middleware: Middleware): this {
        this.middleware.push({
            type: "Middleware",
            middleware: middleware,
        });
        return this;
    }

    before<T extends BeforeFunction<C["path"], C["parsed"]>>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<BeforeFunctionRouteBuilderContext<C, T>> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                ParsedParsers<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteGroupBuilderUnparsed<
            BeforeFunctionRouteBuilderContext<C, T>
        >;
    }

    validate<T extends UnvalidatedFunctions<C["validators"]>>(
        validators: T
    ): RouteGroupBuilderUnparsed<
        ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
    > {
        for (const [type, validator] of Object.entries(validators)) {
            this.middleware.push({
                type: "Validator",
                validator: validator as ValidatorFunction<unknown>,
                validatorType: type as ValidatorType,
            });
        }

        return this as unknown as RouteGroupBuilderUnparsed<
            ValidateRouteBuilderContext<C, ValidatedFunctions<T>>
        >;
    }

    handle(): RouteGroup<C> {
        this.routeGroup = new RouteGroupBackend<C>(this.path);
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

class RouteGroupBackend<C extends RouteBuilderContext>
    implements RouteGroup<C>, BuildableToRoutes
{
    routeBuilders: BuildableToRoutes[] = [];
    groupBuilders: BuildableToRoutes[] = [];

    constructor(readonly path: C["path"]) {}

    private joinPaths<T extends Path>(path: T): JoinPaths<C["path"], T> {
        return (((this.path as Path) === "/" ? "" : this.path) +
            ((path as Path) === "/" ? "" : path) || "/") as JoinPaths<
            C["path"],
            T
        >;
    }

    on<T extends Method, U extends Path>(
        method: T,
        path: CheckPath<JoinPaths<C["path"], U>> extends PathError
            ? CheckPath<JoinPaths<C["path"], U>>
            : U
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, U, [T]>> {
        const builder = new RouteBuilder<
            GroupOutRouteBuilderContext<C, U, [T]>
        >(this.joinPaths(path as U), [method]);
        this.routeBuilders.push(builder);

        return builder;
    }

    get<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["GET"]>> {
        return this.on("GET", path);
    }

    post<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["POST"]>> {
        return this.on("POST", path);
    }

    put<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["PUT"]>> {
        return this.on("PUT", path);
    }

    delete<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsed<GroupOutRouteBuilderContext<C, T, ["DELETE"]>> {
        return this.on("DELETE", path);
    }

    all<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteBuilderUnparsedAllMethods<
        GroupOutRouteBuilderContext<C, T, unknown>
    > {
        const builder = new RouteBuilderAllMethods(
            (this.path + path) as JoinPaths<C["path"], T>
        );
        this.routeBuilders.push(builder);

        // IDK why this one needs the as while the on method dosnt
        return builder as unknown as RouteBuilderUnparsedAllMethods<
            GroupOutRouteBuilderContext<C, T, unknown>
        >;
    }

    group<T extends Path>(
        path: CheckPath<JoinPaths<C["path"], T>> extends PathError
            ? CheckPath<JoinPaths<C["path"], T>>
            : T
    ): RouteGroupBuilderUnparsed<GroupOutRouteBuilderContext<C, T, unknown>> {
        const groupBuilder = new RouteGroupBuilder<
            GroupOutRouteBuilderContext<C, T, unknown>
        >((this.path + path) as JoinPaths<C["path"], T>);
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

