import { FirstSlug, LastSlug, Path, RestSlugs } from "./path.js";

type PathErrors = {
    TrailingSlash: "CANNOT END PATH WITH TRAILING SLASH";
    FollowedWildcard: "WILDCARDS CANNOT BE FOLLOWED BY ROUTES";
    EmptyDynamicName: "EMPTY DYNAMIC PATH NAME";
    OptionalFollowOptional: "OPTIONAL DYNAMIC ROUTES CAN ONLY BE FOLLOWED BY OTHER OPTIONAL ROUTES";
    StartWithSlash: "ROUTES MUST START WITH A SLASH";
};

export type PathError = PathErrors[keyof PathErrors];

type ContainsOptional<T extends Path> = T extends `/${string}?${string}`
    ? true
    : false;

type PathRecursive<T extends Path> = T extends "/"
    ? PathErrors["TrailingSlash"]
    : WildcardOptionalPath<T>;

type WildcardOptionalPath<T extends Path> =
    FirstSlug<T> extends `/*?`
        ? RestSlugs<T> extends never
            ? T
            : PathErrors["FollowedWildcard"]
        : WildcardPath<T>;
type WildcardPath<T extends Path> =
    FirstSlug<T> extends `/*`
        ? RestSlugs<T> extends never
            ? T
            : PathErrors["FollowedWildcard"]
        : DynamicOptionalPath<T>;
type DynamicOptionalPath<T extends Path> =
    FirstSlug<T> extends `/:${infer Name}?`
        ? Name extends ""
            ? PathErrors["EmptyDynamicName"]
            : RestSlugs<T> extends never
              ? T
              : PathRecursiveOptional<RestSlugs<T>>
        : DynamicPath<T>;
type DynamicPath<T extends Path> =
    FirstSlug<T> extends `/:${infer Name}`
        ? Name extends ""
            ? PathErrors["EmptyDynamicName"]
            : RestSlugs<T> extends never
              ? T
              : PathRecursive<RestSlugs<T>>
        : StaticPath<T>;
type StaticPath<T extends Path> =
    RestSlugs<T> extends never ? T : PathRecursive<RestSlugs<T>>;

type PathRecursiveOptional<T extends Path> = T extends "/"
    ? PathErrors["TrailingSlash"]
    : WildcardOnlyOptionalPath<T>;
type WildcardOnlyOptionalPath<T extends Path> =
    FirstSlug<T> extends `/*?`
        ? RestSlugs<T> extends never
            ? T
            : PathErrors["FollowedWildcard"]
        : DynamicOnlyOptionalPath<T>;
type DynamicOnlyOptionalPath<T extends Path> =
    FirstSlug<T> extends `/:${infer Name}?`
        ? Name extends ""
            ? PathErrors["EmptyDynamicName"]
            : RestSlugs<T> extends never
              ? T
              : PathRecursiveOptional<RestSlugs<T>>
        : PathErrors["OptionalFollowOptional"];

/**
 * Used to make sure paths passed to route builders are valid. If they are
 * invalid a string explaining the error will be returned. Else just the passed
 * generic will be.
 */
export type CheckPath<T extends Path> = T extends "/" ? T : PathRecursive<T>;

/** Used to give autocomplete suggestions on a path. Doesn't work currently. */
export type AutocompletePath<T extends Path> =
    `${T}${(LastSlug<T> extends `/:${infer Name}` ? (Name extends `${string}?` ? never : "?/:" | "?/*?" | "?") : never) | (ContainsOptional<T> extends true ? never : "/" | "/*" | "/*?")}`;

