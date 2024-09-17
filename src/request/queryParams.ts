import { throwUnparseableError } from "../error.js";
import { ParserFunction } from "../types/parser.js";
import { Validators } from "../validate.js";

function multipartRecursiveInsert(
    key: string,
    value: unknown,
    parent: Record<string, unknown> | unknown[]
): void {
    let firstKey;
    let restKey;
    if (key.includes(".")) {
        firstKey = key.slice(0, key.indexOf("."));
        restKey = key.slice(firstKey.length + 1);
    } else {
        firstKey = key;
        restKey = "";
    }
    if (Array.isArray(parent)) {
        if (firstKey !== "") {
            // Named arguments cannot exist on an implicit array.
            return;
        }

        parent.push(value);

        return;
    }

    const existingItem = parent[firstKey];

    if (Array.isArray(existingItem)) {
        multipartRecursiveInsert(restKey, value, existingItem);
    } else if (typeof existingItem === "object" && existingItem !== null) {
        multipartRecursiveInsert(
            restKey,
            value,
            existingItem as Record<string, unknown>
        );
    } else if (existingItem === undefined) {
        if (restKey !== "") {
            const newParent = {};
            parent[firstKey] = newParent;
            multipartRecursiveInsert(restKey, value, newParent);
        } else {
            parent[firstKey] = value;
        }
    } else {
        const newParent = [existingItem];
        parent[firstKey] = newParent;
        multipartRecursiveInsert(restKey, value, newParent);
    }
}

/** Handles query params for requests. */
export class QueryParams<V extends Validators["query"]> {
    private readonly queryParams: URLSearchParams;
    /**
     * Same as {@link QueryParams.get} exept it only contains validated query
     * params.
     */
    validated: V;

    constructor(queryParams: URLSearchParams, validatedQueryParams: V) {
        this.queryParams = queryParams;
        this.validated = validatedQueryParams;
    }

    get<T extends string>(
        name: T
    ): V extends NonNullable<unknown>
        ? T extends keyof V
            ? V[T]
            : string | undefined
        : string | undefined {
        if (this.validated && (this.validated as Record<string, unknown>)[name])
            return (this.validated as Record<string, unknown>)[
                name
            ] as V extends NonNullable<unknown>
                ? T extends keyof V
                    ? V[T]
                    : string | undefined
                : string | undefined;

        return (this.queryParams.get(name) ||
            undefined) as V extends NonNullable<unknown>
            ? T extends keyof V
                ? V[T]
                : string | undefined
            : string | undefined;
    }

    getAndParse<T extends ParserFunction<string | undefined>>(
        name: string,
        parser: T
    ): ReturnType<T> {
        const queryParam = this.get(name);
        const parsed = parser({
            param: queryParam,
            unparseable: () => throwUnparseableError(name),
        });

        return parsed as ReturnType<T>;
    }

    /**
     * Returns a `Map` of all the query params. It does not care about validated
     * params and only returns the original ones sent with the request.
     */
    all(): Readonly<Map<string, string>> {
        const queryParams = new Map<string, string>();
        for (const [key, value] of this.queryParams.entries()) {
            queryParams.set(key, value);
        }

        return queryParams;
    }

    /**
     * Converts and returns all query parameters as a plain old JavaScript
     * object.
     *
     * @example
     *     "name=John&pet=cat" => { name: "John", pet: "cat" }
     *     "user.name=John&user.pet=cat" => {user: { name: "John", pet: "cat" }}
     *     "pets=cat&pets=dog" => { pets: ["cat", "dog"] }
     */
    toObject(): unknown {
        const asObject = {};

        for (const [key, value] of this.queryParams.entries()) {
            multipartRecursiveInsert(
                key,
                value === "" ? true : value,
                asObject
            );
        }

        return asObject;
    }
}

