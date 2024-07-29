import http from "http";
import type { Method, Path } from "./router";
import type { Server } from "./server";

type InfoStatusCode = 100 | 101 | 102 | 103;
type SuccessStatusCode =
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
type RedirectStatusCode = 300 | 301 | 302 | 303 | 304 | 307 | 308;
type ClientErrorStatusCode =
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
type ServerErrorStatusCode =
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

type StatusCode =
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

export class Response<R extends Path, M extends Method[] | null> {
    constructor(
        private readonly server: Server,
        private readonly response: http.ServerResponse
    ) {}

    header(name: string, value: string): this {
        this.response.setHeader(name, value);

        return this;
    }

    headers(headers: Record<string, string>): this {
        for (const [name, value] of Object.entries(headers)) {
            this.response.setHeader(name, value);
        }

        return this;
    }

    status(statusCode: StatusCode): this {
        this.response.statusCode = statusCode;

        return this;
    }

    write(chunk: any): Promise<this> {
        return new Promise((resolve, reject) => {
            this.response.write(chunk, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(this);
            });
        });
    }

    body(body: string): void {
        this.response.end(body);
    }

    text(body: string): void {
        this.header(HEADERS.contentType.name, HEADERS.contentType.values.text);
        this.body(body);
    }

    json(body: Record<string, unknown> | Record<string, unknown>[]): void {
        this.header(HEADERS.contentType.name, HEADERS.contentType.values.json);
        this.body(JSON.stringify(body));
    }

    html(body: string): void {
        this.header(HEADERS.contentType.name, HEADERS.contentType.values.html);
        this.body(body);
    }

    ok(): this {
        this.status(200);

        return this;
    }
}
