import { Path } from "./path.js";
import { PathParams } from "./pathParams.js";

/**
 * A function that should be called if the data was invalid. Throws an http
 * error.
 */
type UnparseableFunction = () => never;

/**
 * Parser function with the type of the param, throw Unparseable error if the
 * dynamic route is invalid.
 */
export type ParserFunction<T> = (data: {
    param: T;
    unparseable: UnparseableFunction;
}) => unknown;

/** The type for custom parser functions. */
export type CustomParserFunction<T, R> = (data: {
    param: T;
    unparseable: UnparseableFunction;
}) => R;

/**
 * The parser functions for a path, should only be used in frontend. Excludes
 * already parsed params
 */
export type ParserFunctionsForPath<
    R extends Path,
    P extends ParsedParsers<ParserFunctions>,
> = Partial<{
    [K in keyof ExcludeAlreadyParsedParams<R, P>]: ParserFunction<
        ExcludeAlreadyParsedParams<R, P>[K]
    >;
}>;

/** Exclued the already parsed from the route */
type ExcludeAlreadyParsedParams<R extends Path, P extends ParsedParsers> = Omit<
    PathParams<R>,
    keyof P
>;

export type ParserFunctions =
    | Record<string, ParserFunction<NonNullable<unknown>>>
    | ParserFunctionsForPath<Path, NonNullable<unknown>>;

/** Get the return type for the parser functions */
export type ParsedParsers<T extends ParserFunctions = ParserFunctions> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in keyof T]: T[K] extends (...args: any) => any
        ? ReturnType<T[K]>
        : undefined;
};

/** Used for front facing params for a specific route */
export type DefaultOrParsedParams<
    R extends Path,
    P extends ParsedParsers,
> = Omit<PathParams<R>, keyof P> & P;

