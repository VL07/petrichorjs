import { Method } from "../router.js";
import { Path } from "../types/path.js";
import { CookieOptions, Response } from "./response.js";
import http from "node:http";
import { StatusCode } from "./statusCode.js";
import { StreamFunction, ResponseStream } from "./responseStream.js";
import { NodeResponseStream } from "./nodeResponseStream.js";

export class NodeResponse<
    R extends Path | null,
    M extends Method[] | unknown,
> extends Response<R, M> {
    constructor(private readonly response: http.ServerResponse) {
        super();
    }

    override header(name: string, value: string): this {
        this.response.setHeader(name, value);

        return this;
    }

    override headers(headers: Record<string, string>): this {
        for (const [name, value] of Object.entries(headers)) {
            this.response.setHeader(name, value);
        }

        return this;
    }

    override status(statusCode: StatusCode): this {
        this.response.statusCode = statusCode;

        return this;
    }

    override cookie(
        name: string,
        value: string,
        options?: Partial<CookieOptions>
    ): this {
        const cookieAsString = this.cookieToString(name, value, options);
        this.header("Set-Cookie", cookieAsString);

        return this;
    }

    override streamResponse(
        streamFunction: StreamFunction<ResponseStream<R, M>>
    ): void {
        if (this.responseStream)
            throw new Error("Each response can only have one response stream!");

        this.internalResponseStream = new NodeResponseStream<R, M>(
            this.response,
            streamFunction
        );
    }

    override _endAndSendContent(): void {
        this.response.end(this.content);
    }

    override get responseStream(): ResponseStream<null, unknown> | undefined {
        return this.internalResponseStream;
    }
}

