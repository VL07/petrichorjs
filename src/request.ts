import http from "http";
import type { Server } from "./server.js";
import type { Method, Path } from "./router.js";
import type { Parsed, ParserFunction, ParserFunctions } from "./builders.js";
import { throwUnparseableError } from "./error.js";

/** Handles query params for requests. */
class QueryParams {
    private readonly queryParams: URLSearchParams;

    constructor(queryParams: URLSearchParams) {
        this.queryParams = queryParams;
    }

    get(name: string): string | undefined {
        return this.queryParams.get(name) || undefined;
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

    all(): Map<string, string> {
        const queryParams = new Map<string, string>();
        for (const [key, value] of queryParams.entries()) {
            queryParams.set(key, value);
        }

        return queryParams;
    }
}

/** The request object for incomming requests. */
export class Request<
    R extends Path,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
> {
    /**
     * The url params with thire types.
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
    readonly query: QueryParams;

    private bodyString: string;

    constructor(
        private readonly server: Server,
        private readonly request: http.IncomingMessage,
        params: P
    ) {
        this.params = params;
        this.url = this.urlFromRequestUrl(request.url!);
        this.method = request.method! as M extends Method[]
            ? M[number]
            : Method;
        this.headers = request.headers as Record<string, string>;
        this.query = new QueryParams(this.url.searchParams);

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
            const chunks: any[] = [];
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
    async json(): Promise<unknown> {
        const body = await this.body();
        return JSON.parse(body);
    }
}
