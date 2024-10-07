import { BodyParser, BodyParserOptions } from "./bodyParser.js";
import http from "node:http";

export class NodeBodyParser extends BodyParser {
    private request: http.IncomingMessage;
    private collectedChunks: Uint8Array[] = [];

    constructor(request: http.IncomingMessage, options: BodyParserOptions) {
        super(options);

        this.request = request;
    }

    private getHeader(name: string): string | undefined {
        const header = this.request.headers[name];
        if (Array.isArray(header)) {
            return header[0];
        }

        return header;
    }

    private getExpectedContentLength(): number {
        const contentLengthRaw =
            this.getHeader("content-length") ||
            this.getHeader("Content-Length");
        if (!contentLengthRaw) throw this.createMissingContentLengthError();

        const contentLength = parseInt(contentLengthRaw);
        if (contentLength > this.options.limit) {
            throw this.createBodyTooBigError();
        }

        return contentLength;
    }

    private removeRequestListeners(): void {
        this.request.removeAllListeners("data");
        this.request.removeAllListeners("end");
        this.request.removeAllListeners("error");
    }

    private collectedChunksToBuffer(): Buffer {
        return Buffer.concat(this.collectedChunks);
    }

    private getCollectedChunksLength(): number {
        return this.collectedChunks.reduce(
            (partialSum, buffer) => partialSum + buffer.byteLength,
            0
        );
    }

    /** Collects the body into memory. */
    private async collectBody(): Promise<Buffer> {
        if (this.request.readableEnded) {
            return this.collectedChunksToBuffer();
        }

        return new Promise((resolve, reject) => {
            this.request.on("data", (chunk) => {
                this.collectedChunks.push(chunk);

                try {
                    // If the request is longer than it said throw!
                    if (
                        this.getCollectedChunksLength() >
                        this.getExpectedContentLength()
                    ) {
                        this.removeRequestListeners();
                        reject(this.createMissmatchedContentLengthError());
                    } else if (
                        this.getCollectedChunksLength() > this.options.limit
                    ) {
                        this.removeRequestListeners();
                        reject(this.createBodyTooBigError());
                    }
                } catch (err) {
                    reject(err);
                }
            });

            this.request.on("end", () => {
                this.removeRequestListeners();

                try {
                    // The expected content length might be larger then what we got
                    if (
                        this.getCollectedChunksLength() !==
                        this.getExpectedContentLength()
                    ) {
                        reject(this.createMissmatchedContentLengthError());
                    }
                } catch (err) {
                    reject(err);
                }

                resolve(this.collectedChunksToBuffer());
            });

            this.request.on("error", (err) => {
                reject(err);
            });
        });
    }

    override async body(): Promise<string> {
        const body = await this.collectBody();

        return body.toString();
    }
}

