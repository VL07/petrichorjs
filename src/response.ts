import http from "http";
import type { Method, Path } from "./router.js";
import type { Server } from "./server.js";

export type InfoStatusCode = 100 | 101 | 102 | 103;
export type SuccessStatusCode =
    | 200
    | 201
    | 202
    | 203
    | 204
    | 205
    | 206
    | 207
    | 208
    | 226;
export type RedirectStatusCode = 300 | 301 | 302 | 303 | 304 | 307 | 308;
export type ClientErrorStatusCode =
    | 400
    | 401
    | 402
    | 403
    | 404
    | 405
    | 406
    | 407
    | 408
    | 409
    | 410
    | 411
    | 412
    | 413
    | 414
    | 415
    | 416
    | 417
    | 418
    | 421
    | 422
    | 423
    | 424
    | 425
    | 426
    | 428
    | 429
    | 431
    | 451;
export type ServerErrorStatusCode =
    | 500
    | 501
    | 502
    | 503
    | 504
    | 505
    | 506
    | 507
    | 508
    | 510
    | 511;

export type StatusCode =
    | InfoStatusCode
    | SuccessStatusCode
    | RedirectStatusCode
    | ClientErrorStatusCode
    | ServerErrorStatusCode;

const HEADERS = {
    contentType: {
        name: "Content-Type",
        values: {
            text: "text/plain",
            json: "application/json",
            html: "text/html",
        },
    },
} as const;

/** @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#information_responses} */
export const statusCodes = {
    Continue: 100,
    SwitchingProtocols: 101,
    Processing: 102,
    EarlyHints: 103,
    Ok: 200,
    Created: 201,
    Accepted: 202,
    NonAuthoritativeInformation: 203,
    NoContent: 204,
    ResetContent: 205,
    PartialContent: 206,
    MultiStatus: 207,
    AlreadyReported: 208,
    IMUsed: 226,
    MultipleChoises: 300,
    MovedPermanently: 301,
    Found: 302,
    SeeOther: 303,
    NotModified: 304,
    TemporaryRedirect: 307,
    PermanentRedirect: 308,
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410,
    LengthRequired: 411,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    URITooLong: 414,
    UnsupportedMediaType: 415,
    RangeNotSatisfiable: 416,
    ExpectationFailed: 417,
    ImATeapot: 418,
    MisdirectedRequest: 421,
    UnprocessableContent: 422,
    Locked: 423,
    FailedDependency: 424,
    TooEarly: 425,
    UpgrageRequired: 426,
    PreconditionRequired: 428,
    TooManyRequests: 429,
    RequestHeaderFieldsTooLarge: 431,
    UnavailableForLegalReasons: 451,
    InternalServerError: 500,
    NotImplemented: 501,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
    HTTPVersionNotSupported: 505,
    VariantAlsoNegotiates: 506,
    InsufficientStorage: 507,
    LoopDetected: 508,
    NotExtended: 510,
    NetworkAuthenticationRequired: 511,
} as const;

interface CookieOptions {
    domail: string;
    expires: Date;
    httpOnly: boolean;
    maxAge: number;
    partitioned: boolean;
    path: string;
    sameSite: "Strict" | "Lax" | "None";
    secure: boolean;
}

type StreamDataEventListener = (chunk: string) => Promise<void> | void;
type StreamCloseEventListener = () => Promise<void> | void;

export type JsonValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | JsonValue[]
    | { [key: string]: JsonValue };

class Stream<R extends Path | null, M extends Method[] | null> {
    private onDataListeners: StreamDataEventListener[] = [];
    private onCloseListeners: StreamCloseEventListener[] = [];

    constructor(
        private readonly server: Server,
        private readonly response: http.ServerResponse,
        private readonly streamFunction: (
            stream: Stream<R, M>
        ) => Promise<void> | void
    ) {}

    /**
     * Creates an event listener that fires when data is sent through the
     * stream, before the data gets sent to the client.
     */
    onData(listener: StreamDataEventListener): void {
        this.onDataListeners.push(listener);
    }

    /**
     * Creates an event listener that fires when the stream is closed, before
     * the stream closes for the client.
     */
    onClose(listener: StreamCloseEventListener): void {
        this.onCloseListeners.push(listener);
    }

    /** **ONLY FOR INTERNAL USE** */
    async start(): Promise<void> {
        this.streamFunction(this);
    }

    /**
     * Writes a chunk to the response, returns a promise that resolves when the
     * client has handled the chunk
     *
     * @example
     *     stream.write("Hello World!"); // Send chunk
     *     stream.close(); // End connection
     */
    async write(chunk: string): Promise<void> {
        for (const dataListener of this.onDataListeners) {
            await dataListener(chunk);
        }

        return new Promise((resolve, reject) => {
            this.response.write(chunk, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    /**
     * Closes the stream, after this nothing more can be written to it. Before
     * it gets closed all middleware {@link onClose} events will be called
     */
    async close(): Promise<void> {
        for (const closeListener of this.onCloseListeners) {
            await closeListener();
        }

        return new Promise((resolve) => {
            this.response.end(() => {
                resolve();
            });
        });
    }

    /** A promise that resolves after the delay */
    sleep(delayMs: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, delayMs);
        });
    }
}

export class Response<R extends Path | null, M extends Method[] | null> {
    stream: Stream<R, M> | undefined;
    content: string | undefined;

    constructor(
        private readonly server: Server,
        private readonly response: http.ServerResponse
    ) {}

    /**
     * Set one header on the response. To set multiple at the same time use the
     * {@link headers} method.
     *
     * @example
     *     response.header("Content-Type", "text/plain");
     */
    header(name: string, value: string): this {
        this.response.setHeader(name, value);

        return this;
    }

    /** Set multiple headers at once and overwrides existing ones. */
    headers(headers: Record<string, string>): this {
        for (const [name, value] of Object.entries(headers)) {
            this.response.setHeader(name, value);
        }

        return this;
    }

    /**
     * Sets the status code of the response
     *
     * @example
     *     response.status(404); // Not found
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status}
     */
    status(statusCode: StatusCode): this {
        this.response.statusCode = statusCode;

        return this;
    }

    /**
     * Sets a cookie on the response headers.
     *
     * @example
     *     response.cookie("session", "abc123");
     *     response.cookie("session", "abc123", { ...options });
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
     *
     * @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie}
     */
    cookie(
        name: string,
        value: string,
        options?: Partial<CookieOptions>
    ): this {
        let optionsString = "";
        if (options) {
            optionsString += options.domail ? `; Domail=${options.domail}` : "";
            optionsString += options.expires
                ? `; Expires=${options.expires}`
                : "";
            optionsString += options.httpOnly ? `; HttpOnly` : "";
            optionsString += options.maxAge ? `; MaxAge=${options.maxAge}` : "";
            optionsString += options.partitioned ? `; Partitioned` : "";
            optionsString += options.path ? `; Path=${options.path}` : "";
            optionsString += options.sameSite
                ? `; SameSite=${options.sameSite}`
                : "";
            optionsString += options.secure ? `; Secure` : "";
        }

        this.header("Set-Cookie", `${name}=${value}${optionsString}`);

        return this;
    }

    /**
     * Creates a stream object and passes it to the callback function. The
     * `stream` streams data back to the client and can be used alongside
     * middleware.
     *
     * @example
     *     response.stream(async (stream) => {
     *         let i = 0;
     *         while (i < 10) {
     *             await stream.write(`${i}\n`);
     *             await stream.sleep(10); // 10 ms
     *             i++;
     *         }
     *         await stream.close();
     *     });
     */
    streamResponse(
        streamFunction: (stream: Stream<R, M>) => Promise<void> | void
    ): void {
        if (this.stream) throw "Only one stream per response!";

        this.stream = new Stream<R, M>(
            this.server,
            this.response,
            streamFunction
        );
    }

    /**
     * Sets the response body, will only be sent to the client after it has gone
     * through all the middleware.
     */
    body(body: string): void {
        this.content = body;
    }

    /** Same as {@link body} but sets the `Content-Type` header to `text/plain` */
    text(body: string): void {
        this.header(HEADERS.contentType.name, HEADERS.contentType.values.text);
        this.body(body);
    }

    /**
     * Same as {@link body} but sets the `Content-Type` header to
     * `application/json`
     */
    json(body: unknown): void {
        this.header(HEADERS.contentType.name, HEADERS.contentType.values.json);
        this.body(JSON.stringify(body));
    }

    /** Same as {@link body} but sets the `Content-Type` header to `text/html` */
    html(body: string): void {
        this.header(HEADERS.contentType.name, HEADERS.contentType.values.html);
        this.body(body);
    }

    /**
     * Responds with a redirection response to the client. Use one of the
     * redirect http codes `3**`. It also sets the `Location` response header.
     *
     * @example
     *     router.get("/protected").handle(({ request, response }) => {
     *         if (!isAuthenticated()) {
     *             response.redirect(303, "/login");
     *             return;
     *         }
     *     });
     *
     * @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections}
     */
    redirect(code: RedirectStatusCode, location: string) {
        this.status(code);
        this.header("Location", location);
    }

    /**
     * Sets the status code to `200` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/200}
     */
    ok(): this {
        this.status(statusCodes.Ok);

        return this;
    }

    /**
     * Sets the status code to `201` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201}
     */
    created(): this {
        this.status(statusCodes.Created);

        return this;
    }

    /**
     * Sets the status code to `400` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400}
     */
    badRequest(): this {
        this.status(statusCodes.BadRequest);

        return this;
    }

    /**
     * Sets the status code to `401` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401}
     */
    unauthorized(): this {
        this.status(statusCodes.Unauthorized);

        return this;
    }

    /**
     * Sets the status code to `403` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403}
     */
    forbidden(): this {
        this.status(statusCodes.Forbidden);

        return this;
    }

    /**
     * Sets the status code to `404` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404}
     */
    notFound(): this {
        this.status(statusCodes.NotFound);

        return this;
    }

    /**
     * Sets the status code to `422` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422}
     */
    unprocessableContent(): this {
        this.status(statusCodes.UnprocessableContent);

        return this;
    }

    /**
     * Sets the status code to `429` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429}
     */
    tooManyRequests(): this {
        this.status(statusCodes.TooManyRequests);

        return this;
    }

    /**
     * Sets the status code to `500` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500}
     */
    internalServerError(): this {
        this.status(statusCodes.InternalServerError);

        return this;
    }

    /**
     * Sets the status code to `501` @see
     * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/501}
     */
    notImplemented(): this {
        this.status(statusCodes.NotImplemented);

        return this;
    }
}
