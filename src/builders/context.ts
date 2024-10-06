import { BeforeFunction, JoinLocals, Locals } from "../middlware/middleware.js";
import { Method } from "../router/router.js";
import { EmptyObject, Prettify } from "../types/common.js";
import { ParsedParsers } from "../types/parser.js";
import { JoinPaths, Path } from "../types/path.js";
import { JoinValidators, Validators } from "../validate.js";

export type RouteBuilderContext<
    R extends Path = Path,
    M extends Method[] | unknown = unknown,
    P extends ParsedParsers = EmptyObject,
    L extends Locals = EmptyObject,
    V extends Validators = EmptyObject,
> = {
    path: R;
    method: M;
    parsed: P;
    locals: L;
    validators: V;
};

export type AddMethodRouteBuilderContext<
    C extends RouteBuilderContext<Path, Method[]>,
    M extends Method,
> = Prettify<Omit<C, "method"> & { method: [...C["method"], M] }>;

export type ParsedRouteBuilderContext<
    C extends RouteBuilderContext,
    P extends ParsedParsers,
> = Prettify<Omit<C, "parsed"> & { parsed: Prettify<C["parsed"] & P> }>;

export type BeforeFunctionRouteBuilderContext<
    C extends RouteBuilderContext,
    T extends BeforeFunction<C["path"], C["parsed"]>,
> = Prettify<
    Omit<C, "locals"> & {
        locals: JoinLocals<C["path"], T, C["locals"], C["parsed"]>;
    }
>;

export type ValidateRouteBuilderContext<
    C extends RouteBuilderContext,
    T extends Validators,
> = Prettify<
    Omit<C, "validators"> & { validators: JoinValidators<C["validators"], T> }
>;

export type GroupOutRouteBuilderContext<
    C extends RouteBuilderContext,
    R extends Path,
    M extends Method[] | unknown,
> = Prettify<
    RouteBuilderContext<
        JoinPaths<C["path"], R>,
        M,
        C["parsed"],
        C["locals"],
        C["validators"]
    >
>;

