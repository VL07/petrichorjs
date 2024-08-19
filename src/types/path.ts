/*
 * > Order of route execution:
 * 1. Static routes
 * 2. Required dynamic parameters (Parser must not return undefined)
 * 3. Optional dynamic parameters (Parser must not return undefined)
 * 4. Required wildcards
 * 5. Optional wildcards
 *
 * > Example:
 * Routes:
 * 1. GET "/users/:id/"
 * 2. GET "/users/:id/comments/:id"
 * 2. GET "/users/:id/*"
 *
 * GET "/users/123/" will match route .1
 * GET "/users/123/comments/456" will match route .2
 * GET "/users/123/abc" will match route .3
 */

/**
 * Path for routes, must start with a slash.
 *
 * @example
 *     ```ts
 *     const path: Path = "/users/:id" // Ok
 *     const path: Path = "users/:id" // Not ok
 *     ```;
 */
export type Path = `/${string}`;

/** Adds a slash to a slug to make it extend {@link Path}. */
export type Slash<T extends string> = `/${T}`;

/**
 * Get the first slug of a path, if none exists `T` (the generic passed) is
 * returned.
 */
export type FirstSlug<T extends Path> = T extends `/${infer Slug}/${string}`
    ? Slash<Slug>
    : T extends `/${infer Slug}`
      ? Slash<Slug>
      : T;

/**
 * Simmilar to {@link} FirstSlug but this one return all the rest slugs of a
 * path, if none exist this one returns `never`.
 */
export type RestSlugs<T extends Path> = T extends `/${string}/${infer Rest}`
    ? Slash<Rest>
    : never;

/** Get the very last slug of a path. */
export type LastSlug<T extends Path> =
    RestSlugs<T> extends never ? T : LastSlug<RestSlugs<T>>;

/** Join two paths together */
export type JoinPaths<A extends Path, B extends Path> = A extends "/"
    ? B
    : B extends "/"
      ? A
      : A extends `/${infer Slug}`
        ? `/${Slug}${B}`
        : never;
