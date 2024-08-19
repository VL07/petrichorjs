/** Returns a object with just one item */
export type ObjectItem<Name extends string> = { [K in Name]: string };

/** Same as {@link ObjectItem} but this one is optional. */
export type OptionalObjectItem<Name extends string> = {
    [K in Name]?: string | undefined;
};

/**
 * Only used to make types prettier. This one fixes joined types (&) to make
 * them look like one object.
 */
export type Mix<T> = { [K in keyof T]: T[K] };
