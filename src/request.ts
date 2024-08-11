import http from "http";
import type { Server } from "./server.js";
import type { Method, Path } from "./router.js";
import type {
    Locals,
    Parsed,
    ParserFunction,
    ParserFunctions,
} from "./builders.js";
import { HttpError, throwUnparseableError } from "./error.js";
import { statusCodes } from "./response.js";
import { Validators } from "./validate.js";

/** Handles query params for requests. */
class QueryParams<V extends Validators["query"]> {
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
        for (const [key, value] of queryParams.entries()) {
            queryParams.set(key, value);
        }

        return queryParams;
    }
}

/** Class storing cookies on requests, can only be read. */
class Cookies {
    private cookies: Map<string, string> = new Map();

    constructor(cookieHeader: string) {
        this.parseCookieHeader(cookieHeader);
    }

    /**
     * Parses the cookie header and mutates this class, therefor it dosn't
     * return anything.
     */
    parseCookieHeader(cookieHeader: string): void {
        const cookies = cookieHeader.split(";").filter((cookie) => cookie);
        for (const cookie of cookies) {
            const splited = cookie.trim().split("=");
            if (splited.length !== 2) continue;

            const name = splited[0].trim();
            const value = splited[1].trim();

            this.cookies.set(name, value);
        }
    }

    /**
     * Gets one cookie from the incomming request, if it dosnt exist the
     * function will return `undefined`.
     */
    get(name: string): string | undefined {
        return this.cookies.get(name);
    }

    /** Gets all the cookies as a map from the incomming request. */
    all(): Readonly<Map<string, string>> {
        return this.cookies;
    }

    /** The number of cookies with the incomming request. */
    size(): number {
        return this.cookies.size;
    }
}

/** The request object for incomming requests. */
export class Request<
    R extends Path | null,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
    L extends Locals,
    V extends Validators,
> {
    /**
     * The url params with thire types after the parsers.
     *
     * @example
     *     router
     *         .get("/users/:id/*?")
     *         .parse({ id: intParser })
     *         .handle(({ request, response }) => {
     *             request.params; // { id: number, wildcard: string | undefined }
     *         });
     */
    readonly params: P;

    /**
     * The url of the request. Don't use this to get query params, instead use
     * the `query` property of this request.
     */
    readonly url: URL;

    /**
     * The path requested by the client, unlike the {@link url} parameter this
     * one is the completely unparsed path requested by the client.
     */
    requestedPath: string;

    /**
     * The path specified for this route in the router.
     *
     * @example
     *     router.get("/users/:id").handle(({ request, response }) => {
     *         request.routerPath; // "/users/:id"
     *     });
     */
    routerPath: R;

    /** The http method used to make the request. It can be non standard. */
    readonly method: M extends Method[] ? M[number] : Method;

    /** The headers sent with the request */
    readonly headers: Record<string, string>;

    /**
     * The url query params from the request
     *
     * @example
     *     request.query.get("id"); // Get one query param
     *     request.query.all(); // Get all query params
     *
     * @see {@link QueryParams}
     */
    readonly query: QueryParams<V["query"]>;

    /** The locals passed from previous before functions */
    locals: L;

    /**
     * Readonly cookies from the incomming request. To send cookies with the
     * response use the `response` object.
     *
     * @example
     *     request.cookies.get("session"); // string | undefined
     *     request.cookies.all(); // Map<string, string>
     *
     * @example
     *     router.get("/").handle(({ request, response }) => {
     *         const welcommedBefore =
     *             request.cookies.get("welcommed") !== undefined;
     *         response.cookie("welcommed", "true");
     *
     *         return response.ok().json({
     *             message: welcommedBefore
     *                 ? "Hello again!"
     *                 : "Welcome to my site!",
     *         });
     *     });
     */
    readonly cookies: Cookies;

    private bodyString: string;

    /** Use {@link Request.json} instead! */
    validatedJsonBody:
        | (V["body"] extends NonNullable<unknown> ? V["body"] : unknown)
        | undefined;

    constructor(
        private readonly server: Server,
        private readonly request: http.IncomingMessage,
        params: P,
        locals: L,
        routerPath: R
    ) {
        this.params = params;
        this.locals = locals;
        this.url = this.urlFromRequestUrl(request.url!);
        this.method = request.method! as M extends Method[]
            ? M[number]
            : Method;
        this.headers = request.headers as Record<string, string>;
        this.query = new QueryParams<V["query"]>(this.url.searchParams, {});
        this.cookies = new Cookies(
            this.headers.Cookie || this.headers.cookie || ""
        );
        this.requestedPath = request.url || "/";
        this.routerPath = routerPath;

        this.bodyString = "";
    }

    private urlFromRequestUrl(url: string): URL {
        return new URL(url, `http://${this.server.host}:${this.server.port}`);
    }

    /**
     * Await the request body and returns it as a string. This method can be
     * used multiple times. To parse the request body as `json` use the
     * {@link json} method on the request.
     *
     * @example
     *     await request.body(); // Text body
     *     await request.json(); // Parsed json body
     */
    body(): Promise<string> | string {
        if (this.request.readableEnded) {
            return this.bodyString;
        }

        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            this.request.on("data", (chunk) => {
                chunks.push(chunk);
            });

            this.request.on("end", () => {
                const chunksAsString = Buffer.concat(chunks).toString();
                this.bodyString = chunksAsString;
                resolve(chunksAsString);
            });

            this.request.on("error", (err) => {
                reject(err);
            });
        });
    }

    /** Same as the {@link body} method. */
    async text(): Promise<string> {
        const body = await this.body();
        return body;
    }

    /** Gets the request body and parses it with `JSON.parse`. */
    async json(): Promise<
        V["body"] extends NonNullable<unknown> ? V["body"] : unknown
    > {
        if (this.validatedJsonBody) return this.validatedJsonBody;

        const body = await this.body();
        try {
            this.validatedJsonBody = JSON.parse(body);
            return this.validatedJsonBody;
        } catch {
            throw new HttpError(
                statusCodes.UnprocessableContent,
                "Expected JSON body!"
            );
        }
    }
}

