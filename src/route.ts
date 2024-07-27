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

export type Params<T extends Path> = DynamicOptionalWildcardRoute<T>;

type ParserFunction<T, R = unknown> = (param: T) => R | undefined;
export type ParserFunctions<R extends Path> = Partial<{
    [K in keyof Params<R>]: ParserFunction<Params<R>[K]>;
}>;
export type Parsed<R extends Path, T extends ParserFunctions<R>> = {
    [K in keyof T]: T[K] extends (...args: any) => any
        ? Exclude<ReturnType<T[K]>, undefined>
        : undefined;
};

export type DefaultOrParsedParams<
    R extends Path,
    P extends Parsed<R, ParserFunctions<R>>,
> = Omit<Params<R>, keyof P> & P;

export type HandlerFunction<
    R extends Path,
    P extends Parsed<R, ParserFunctions<R>>,
> = (params: DefaultOrParsedParams<R, P>) => void | Promise<void>;

export class Route {
    constructor(
        readonly route: Path,
        readonly method: Method,
        private parsers: ParserFunctions<Path>,
        private readonly handler: HandlerFunction<Path, any>
    ) {}

    async handleRequest(params: any) {
        await this.handler(params);
    }
}
