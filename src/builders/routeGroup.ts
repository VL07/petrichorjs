import {
    BeforeFunction,
    JoinLocals,
    Locals,
    Middleware,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Route } from "../route.js";
import { Method } from "../router.js";
import {
    ParsedParsers,
    ParserFunctions,
    ParserFunctionsForPath,
} from "../types/parser.js";
import { JoinPaths, Path } from "../types/path.js";
import { AutocompletePath, CheckPath, PathError } from "../types/pathCheck.js";
import {
    JoinValidators,
    UnvalidatedFunctions,
    ValidatedFunctions,
    ValidatorFunction,
    Validators,
    ValidatorType,
} from "../validate.js";
import { BuildableToRoutes } from "./index.js";
import { RouteBuilder, RouteBuilderUnparsed } from "./route.js";
import {
    RouteBuilderAllMethods,
    RouteBuilderUnparsedAllMethods,
} from "./routeAllMethods.js";

interface RouteGroupBuilderParsed<
    R extends Path,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> {
    /** @see {@link RouteBuilderParsed.handle} */
    handle(): RouteGroup<R, P, L, V>;
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteGroupBuilderParsed<R, P, JoinLocals<R, T, L, P>, V>;
    validate<T extends UnvalidatedFunctions<V>>(
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
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> extends RouteGroupBuilderParsed<R, P, L, V> {
    use(middleware: Middleware): this;
    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<R, P, JoinLocals<R, T, L, P>, V>;
    validate<T extends UnvalidatedFunctions<V>>(
        validators: T
    ): RouteGroupBuilderUnparsed<
        R,
        P,
        L,
        JoinValidators<ValidatedFunctions<T>, V>
    >;
    parse<T extends ParserFunctionsForPath<R, P>>(
        parsers: T
    ): RouteGroupBuilderParsed<R, P & ParsedParsers<T>, L, V>;
}

interface RouteGroup<
    R extends Path,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> {
    on<T extends Method, U extends Path>(
        method: T,
        path: CheckPath<U> extends PathError
            ? CheckPath<U> | NoInfer<AutocompletePath<U>>
            : NoInfer<U | AutocompletePath<U>>
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P, L, V>;

    get<T extends Path>(
        path: CheckPath<T> extends PathError
            ? CheckPath<T> | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P, L, V>;
    post<T extends Path>(
        path: CheckPath<T> extends PathError
            ? CheckPath<T> | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P, L, V>;
    put<T extends Path>(
        path: CheckPath<T> extends PathError
            ? CheckPath<T> | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P, L, V>;
    delete<T extends Path>(
        path: CheckPath<T> extends PathError
            ? CheckPath<T> | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P, L, V>;

    all<T extends Path>(
        path: CheckPath<T> extends PathError
            ? CheckPath<T> | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsedAllMethods<JoinPaths<R, T>, P, L, V>;

    group<T extends Path>(
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteGroupBuilderUnparsed<JoinPaths<R, T>, P, L, V>;
}

export class RouteGroupBuilder<
        R extends Path,
        P extends ParsedParsers,
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
    ): RouteGroupBuilderParsed<R, P & ParsedParsers<T>, L, V> {
        this.parsers = parsers;
        return this as unknown as RouteGroupBuilderParsed<
            R,
            P & ParsedParsers<T>,
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

    before<T extends BeforeFunction<R, P>>(
        beforeFunction: T
    ): RouteGroupBuilderUnparsed<R, P, JoinLocals<R, T, L, P>, V> {
        this.middleware.push({
            type: "Before",
            before: beforeFunction as unknown as BeforeFunction<
                Path,
                ParsedParsers<ParserFunctions>,
                Validators
            >,
        });

        return this as unknown as RouteGroupBuilderUnparsed<
            R,
            P,
            JoinLocals<R, T, L, P>,
            V
        >;
    }

    validate<T extends UnvalidatedFunctions<V>>(
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
        P extends ParsedParsers,
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
        path: CheckPath<U> extends PathError
            ? (PathError & CheckPath<U>) | NoInfer<AutocompletePath<U>>
            : NoInfer<U | AutocompletePath<U>>
    ): RouteBuilderUnparsed<JoinPaths<R, U>, [T], P, L, V> {
        const builder = new RouteBuilder<JoinPaths<R, U>, [T], P, L, V>(
            this.joinPaths(path as U),
            [method]
        );
        this.routeBuilders.push(builder);

        return builder;
    }

    get<T extends Path>(
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["GET"], P, L, V> {
        return this.on("GET", path);
    }

    post<T extends Path>(
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["POST"], P, L, V> {
        return this.on("POST", path);
    }

    put<T extends Path>(
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["PUT"], P, L, V> {
        return this.on("PUT", path);
    }

    delete<T extends Path>(
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
    ): RouteBuilderUnparsed<JoinPaths<R, T>, ["DELETE"], P, L, V> {
        return this.on("DELETE", path);
    }

    all<T extends Path>(
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
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
        path: CheckPath<T> extends PathError
            ? (PathError & CheckPath<T>) | NoInfer<AutocompletePath<T>>
            : NoInfer<T | AutocompletePath<T>>
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

