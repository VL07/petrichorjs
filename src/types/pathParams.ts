import { Mix, ObjectItem, OptionalObjectItem } from "./common.js";
import { FirstSlug, Path, RestSlugs } from "./path.js";

type PathRecursive<T extends Path | never> = T extends never
    ? {}
    : T extends "/"
      ? never
      : WildcardOptionalPath<T>;

type WildcardOptionalPath<T extends Path> =
    FirstSlug<T> extends `/*?`
        ? RestSlugs<T> extends never
            ? OptionalObjectItem<"wildcard">
            : never
        : WildcardPath<T>;
type WildcardPath<T extends Path> =
    FirstSlug<T> extends `/*`
        ? RestSlugs<T> extends never
            ? ObjectItem<"wildcard">
            : never
        : DynamicOptionalPath<T>;
type DynamicOptionalPath<T extends Path> =
    FirstSlug<T> extends `/:${infer Name}?`
        ? Name extends ""
            ? never
            : RestSlugs<T> extends never
              ? OptionalObjectItem<Name>
              : OptionalObjectItem<Name> & PathRecursiveOptional<RestSlugs<T>>
        : DynamicPath<T>;
type DynamicPath<T extends Path> =
    FirstSlug<T> extends `/:${infer Name}`
        ? Name extends ""
            ? never
            : RestSlugs<T> extends never
              ? ObjectItem<Name>
              : ObjectItem<Name> & PathRecursive<RestSlugs<T>>
        : StaticPath<T>;
type StaticPath<T extends Path> =
    RestSlugs<T> extends never ? {} : PathRecursive<RestSlugs<T>>;

type PathRecursiveOptional<T extends Path | never> = T extends never
    ? {}
    : T extends "/"
      ? never
      : WildcardOnlyOptionalPath<T>;
type WildcardOnlyOptionalPath<T extends Path> =
    FirstSlug<T> extends `/*?`
        ? RestSlugs<T> extends never
            ? OptionalObjectItem<"wildcard">
            : never
        : DynamicOnlyOptionalPath<T>;
type DynamicOnlyOptionalPath<T extends Path> =
    FirstSlug<T> extends `/:${infer Name}?`
        ? Name extends ""
            ? never
            : RestSlugs<T> extends never
              ? OptionalObjectItem<Name>
              : OptionalObjectItem<Name> & PathRecursiveOptional<RestSlugs<T>>
        : never;

/** Get the params, and thire value, from a path */
export type PathParams<T extends Path> = T extends "/"
    ? {}
    : Mix<PathRecursive<T>>;

