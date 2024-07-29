import http from "http";
import type { Server } from "./server.js";
import type { Method, Path } from "./router.js";
import type { Parsed, ParserFunction, ParserFunctions } from "./builders.js";
import { throwUnparseableError } from "./error.js";

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

export class Request<
    R extends Path,
    M extends Method[] | null,
    P extends Parsed<ParserFunctions>,
> {
    readonly params: P;
    readonly url: URL;
    readonly method: M extends Method[] ? M[number] : Method;
    readonly headers: Record<string, string>;
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

    async text(): Promise<string> {
        const body = await this.body();
        return body;
    }

    async json(): Promise<string> {
        const body = await this.body();
        return JSON.parse(body);
    }
}
