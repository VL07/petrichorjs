import { Locals } from "../middlware/middleware.js";
import { Method } from "../router/router.js";
import { ParsedParsers } from "../types/parser.js";
import { Path } from "../types/path.js";
import { Validators } from "../validate.js";
import { BodyParser } from "./bodyParser.js";
import { Cookies } from "./cookies.js";
import { QueryParams } from "./queryParams.js";
import { Request } from "./request.js";
import http from "node:http";

export class NodeRequest<
    R extends Path | null,
    M extends Method[] | unknown,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> extends Request<R, M, P, L, V> {
    override params: P;
    override url: URL;
    override routerPath: R;
    override method: M extends string[] ? M[number] : string;
    override headers: Record<string, string>;
    override query: QueryParams<V["query"]>;
    override locals: L;
    override cookies: Cookies;
    override contentType: string | undefined;
    override requestedPath: string;

    constructor(
        private readonly request: http.IncomingMessage,
        private readonly bodyParser: BodyParser,
        params: P,
        locals: L,
        routerPath: R,
        url: URL
    ) {
        super();

        this.params = params;
        this.url = url;
        this.routerPath = routerPath;
        this.method = request.method as M extends string[] ? M[number] : string;
        this.headers = request.headers as Record<string, string>;
        this.query = new QueryParams<V["query"]>(url.searchParams, {});
        this.locals = locals;
        this.cookies = new Cookies(this.getCookieHeaderValue() || "");
        this.contentType = this.getContentTypeHeaderValue();
        this.requestedPath = request.url || "";
    }

    private getCookieHeaderValue(): string | undefined {
        return this.headers["Cookie"] || this.headers["cookie"];
    }

    private getContentTypeHeaderValue(): string | undefined {
        return (
            (this.headers["Content-Type"] || this.headers["content-type"] || "")
                .split(";")
                .at(0) || undefined
        );
    }

    override async body(): Promise<string> {
        return await this.bodyParser.body();
    }

    get requestBodyEnded(): boolean {
        return this.request.readableEnded;
    }
}

