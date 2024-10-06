import { statusCodes } from "../response/statusCode.js";
import { Method } from "../router/router.js";
import { Path } from "../types/path.js";
import { ResponseStream, StreamFunction } from "./responseStream.js";
import { RedirectStatusCode, StatusCode } from "./statusCode.js";

export interface CookieOptions {
    domain: string;
    expires: Date;
    httpOnly: boolean;
    maxAge: number;
    partitioned: boolean;
    path: string;
    sameSite: "Strict" | "Lax" | "None";
    secure: boolean;
}

export abstract class Response<
    R extends Path | null,
    M extends Method[] | unknown,
> {
    internalResponseStream: ResponseStream<R, M> | undefined;
    content: string | undefined;

    protected cookieToString(
        name: string,
        value: string,
        options?: Partial<CookieOptions>
    ) {
        let optionsString = "";
        if (options) {
            optionsString += options.domain ? `; Domain=${options.domain}` : "";
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

        return `${name}=${value}${optionsString}`;
    }

    /**
     * Set one header on the response. To set multiple at the same time use the
     * {@link headers} method.
     *
     * @example
     *     response.header("Content-Type", "text/plain");
     */
    abstract header(name: string, value: string): this;

    /** Set multiple headers at once and overwrides existing ones. */
    abstract headers(headers: Record<string, string>): this;

    /**
     * Sets the status code of the response
     *
     * @example
     *     response.status(404); // Not found
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status}
     */
    abstract status(statusCode: StatusCode): this;

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
    abstract cookie(
        name: string,
        value: string,
        options?: Partial<CookieOptions>
    ): this;

    /**
     * Creates a stream object and passes it to the callback function. The
     * `stream` streams data back to the client and can be used alongside
     * middleware.
     *
     * @example
     *     response.streamResponse(async (stream) => {
     *         let i = 0;
     *         while (i < 10) {
     *             await stream.write(`${i}\n`);
     *             await stream.sleep(10); // 10 ms
     *             i++;
     *         }
     *         await stream.close();
     *     });
     */
    abstract streamResponse(
        streamFunction: StreamFunction<ResponseStream<R, M>>
    ): void;

    /**
     * Send the content in the {@link content} variable and close the connection
     *
     * @internal
     */
    abstract _endAndSendContent(): void;

    /** Get this response's {@link ResponseStream}. */
    abstract get responseStream(): ResponseStream<R, M> | undefined;

    /**
     * Sets the response body, will only be sent to the client after it has gone
     * through all the middleware.
     */
    body(body: string): void {
        this.content = body;
    }

    /** Same as {@link body} but sets the `Content-Type` header to `text/plain` */
    text(body: string): void {
        this.header("Content-Type", "text/plain");
        this.body(body);
    }

    /**
     * Same as {@link body} but sets the `Content-Type` header to
     * `application/json`
     */
    json(body: unknown): void {
        this.header("Content-Type", "application/json");
        this.body(JSON.stringify(body));
    }

    /** Same as {@link body} but sets the `Content-Type` header to `text/html` */
    html(body: string): void {
        this.header("Content-Type", "text/html");
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

