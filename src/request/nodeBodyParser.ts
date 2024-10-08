import { HttpError } from "../error.js";
import { statusCodes } from "../response/statusCode.js";
import {
    BodyParser,
    BodyParserOptions,
    ParsedJsonBody,
    ParsedTextBody,
} from "./bodyParser.js";
import http from "node:http";

function getHeader(
    headers: http.IncomingHttpHeaders,
    name: string
): string | undefined {
    const header = headers[name];
    if (Array.isArray(header)) {
        return header[0];
    }

    return header;
}

export class NodeBodyParser extends BodyParser {
    private readonly request: http.IncomingMessage;

    constructor(request: http.IncomingMessage, options: BodyParserOptions) {
        super(
            options,
            getHeader(request.headers, "content-type") ||
                getHeader(request.headers, "Content-Type")
        );

        this.request = request;
    }

    private getExpectedContentLength(): number {
        const contentLengthRaw =
            getHeader(this.request.headers, "content-length") ||
            getHeader(this.request.headers, "Content-Length");
        if (!contentLengthRaw) throw this.createMissingContentLengthError();

        const contentLength = parseInt(contentLengthRaw);
        if (contentLength > this.contentTypeOptions.limit) {
            throw this.createBodyTooBigError();
        }

        return contentLength;
    }

    private getCollectedChunksLength(chunks: Uint8Array[]): number {
        return chunks.reduce(
            (partialSum, chunk) => partialSum + chunk.byteLength,
            0
        );
    }

    private async collectBody(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const collectedChunks: Uint8Array[] = [];

            this.request.on("data", (chunk) => {
                collectedChunks.push(chunk);

                try {
                    // If the request is longer than it said throw!
                    if (
                        this.getCollectedChunksLength(collectedChunks) >
                        this.getExpectedContentLength()
                    ) {
                        reject(this.createMissmatchedContentLengthError());
                    } else if (
                        this.getCollectedChunksLength(collectedChunks) >
                        this.contentTypeOptions.limit
                    ) {
                        reject(this.createBodyTooBigError());
                    }
                } catch (err) {
                    reject(err);
                }
            });

            this.request.on("end", () => {
                try {
                    // The expected content length might be larger then what we got
                    if (
                        this.getCollectedChunksLength(collectedChunks) !==
                        this.getExpectedContentLength()
                    ) {
                        reject(this.createMissmatchedContentLengthError());
                    }
                } catch (err) {
                    reject(err);
                }

                resolve(Buffer.concat(collectedChunks));
            });

            this.request.on("error", (err) => {
                reject(err);
            });
        });
    }

    protected override async handleTextRequest(): Promise<ParsedTextBody> {
        const body = await this.collectBody();

        return body.toString(this.contentTypeOptions.encoding);
    }

    private setEmptyStringsToNull(object: Record<string, unknown>): void {
        for (const [key, value] of Object.entries(object)) {
            if (value === "") {
                object[key] = null;
            } else if (typeof value === "object" && value !== null) {
                this.setEmptyStringsToNull(value as Record<string, unknown>);
            }
        }
    }

    protected override async handleJsonRequest(): Promise<ParsedJsonBody> {
        const body = await this.collectBody();
        const bodyAsString = body.toString(this.contentTypeOptions.encoding);

        if (bodyAsString === "") {
            return {};
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(bodyAsString);
        } catch {
            throw new HttpError(
                statusCodes.UnprocessableContent,
                "Invalid json!"
            );
        }

        if (
            this.options.json.convertEmptyStringsToNull &&
            typeof parsed === "object" &&
            parsed !== null
        ) {
            this.setEmptyStringsToNull(parsed as Record<string, unknown>);
        }

        if (parsed === "") return null;

        return parsed;
    }
}

