import http from "http";
import type { Server } from "./server.js";
import type { Method } from "./router.js";
import { HttpError, throwUnparseableError } from "./error.js";
import { statusCodes } from "./response.js";
import { Validators } from "./validate.js";
import formidable, { Fields, Files } from "formidable";
import IncomingForm from "formidable/Formidable.js";
import { ParsedParsers, ParserFunction } from "./types/parser.js";
import { Path } from "./types/path.js";
import { Locals } from "./middlware/middleware.js";

type ParsedMultipart<T> = Readonly<{
    [key: string]: T | T[] | ParsedMultipart<T>;
}>;

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

            // They are not going to be undefined because i checked the length
            const name = splited[0]!.trim();
            const value = splited[1]!.trim();

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
    P extends ParsedParsers,
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

    /** The value of the `Content-Type` header on the request */
    readonly contentType: string | undefined;

    private bodyString: string;
    private multipartFiles: Files | undefined;
    private isMultipartRequest: boolean;
    private multipartForm: IncomingForm | undefined;
    private handledMultipartRequest: boolean = false;

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
            this.headers["Cookie"] || this.headers["cookie"] || ""
        );
        this.requestedPath = request.url || "/";
        this.routerPath = routerPath;

        this.bodyString = "";

        this.contentType =
            (this.headers["Content-Type"] || this.headers["content-type"] || "")
                .split(";")
                .at(0) || undefined;

        this.isMultipartRequest = this.contentType === "multipart/form-data";

        if (this.isMultipartRequest) {
            this.multipartForm = formidable({});

            let chunks: string = "";

            this.multipartForm.on("data", (data) => {
                chunks += data.buffer;
            });

            this.multipartForm.once("end", () => {
                this.bodyString = chunks;
            });
        }
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
    async body(): Promise<string> {
        if (this.request.readableEnded) {
            return this.bodyString;
        }

        if (this.isMultipartRequest) {
            await this.handleMultipartRequest();
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

    /**
     * Gets the request body and parses it with `JSON.parse`. If the
     * `Content-Type` header on the request is
     * `application/x-www-form-urlencoded` then this function also converts it
     * into json. If multiple input elements in the form data have the same name
     * then a array will be created for those values. Files sent with the
     * request when the `Content-Type` header on the request is set to
     * `application/x-www-form-urlencoded` will also be returned from here. If
     * you only want the files you can use the {@link Request.files} or
     * {@link Request.filesFlat} method.
     */
    async json(): Promise<
        V["body"] extends NonNullable<unknown> ? V["body"] : unknown
    > {
        if (this.validatedJsonBody) return this.validatedJsonBody;

        if (this.contentType === "application/x-www-form-urlencoded") {
            const body = await this.body();
            const asSearchParams = new URLSearchParams(body);
            const asQueryParams = new QueryParams(asSearchParams, {});
            const asJson = asQueryParams.toObject();

            this.validatedJsonBody = asJson;
            return this.validatedJsonBody;
        } else if (this.contentType === "multipart/form-data") {
            await this.handleMultipartRequest();
            return this.validatedJsonBody;
        } else {
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

    private async handleMultipartRequest(): Promise<void> {
        if (!this.multipartForm) throw "Wrong content type!";
        if (this.handledMultipartRequest) return;

        this.handledMultipartRequest = true;

        let fields: Fields;
        let files: Files;
        try {
            [fields, files] = await this.multipartForm.parse(this.request);
        } catch {
            throw new HttpError(
                statusCodes.UnprocessableContent,
                "Invalid form data body!"
            );
        }

        const fieldsAsObject = {};

        for (const [key, valueArray] of Object.entries(fields)) {
            if (!valueArray) continue;
            for (const value of valueArray) {
                multipartRecursiveInsert(key, value, fieldsAsObject);
            }
        }

        for (const [key, fileArray] of Object.entries(files)) {
            if (!fileArray) continue;
            for (const file of fileArray) {
                multipartRecursiveInsert(key, file, fieldsAsObject);
            }
        }

        this.validatedJsonBody = fieldsAsObject;
        this.multipartFiles = files;
    }

    /**
     * Returns all the files sent with the request. The `Content-Type` header of
     * the request has to be set to `multipart/form-data` for it to return any
     * files. The files are categorized the same way as how url encoded data
     * would be parsed in the {@link Request.json} function. The files with the
     * request will also be returned from the {@link Request.json} function.
     *
     * @example
     *     const files = await request.files();
     */
    async files(): Promise<ParsedMultipart<formidable.File>> {
        if (!this.isMultipartRequest) return {};

        await this.handleMultipartRequest();
        if (!this.multipartFiles) return {};

        const parsedObject = {};
        for (const [key, fileArray] of Object.entries(this.multipartFiles)) {
            if (!fileArray) continue;
            for (const file of fileArray) {
                multipartRecursiveInsert(key, file, parsedObject);
            }
        }

        return parsedObject;
    }

    /**
     * Returns the files sent with the request but not parsed like how the
     * {@link Request.files} function would do it.
     */
    async filesFlat(): Promise<Readonly<Record<string, formidable.File[]>>> {
        if (!this.isMultipartRequest) return {};

        await this.handleMultipartRequest();
        if (!this.multipartFiles) return {};

        const parsed: Record<string, formidable.File[]> = {};
        for (const [key, file] of Object.entries(this.multipartFiles)) {
            if (!file) continue;

            parsed[key] = file;
        }

        return parsed;
    }
}

