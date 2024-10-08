import { HttpError } from "../error.js";
import { statusCodes } from "../response/statusCode.js";

export enum BodyParserContentType {
    Text,
    Json,
}

/** The options for body parsers */
export type BodyParserOptions = {
    text: {
        limit: number;
        contentTypes: Set<string>;
        encoding: BufferEncoding;
    };
    json: {
        limit: number;
        contentTypes: Set<string>;
        encoding: BufferEncoding;
        convertEmptyStringsToNull: boolean;
    };
};

type ContentTypeOptions = BodyParserOptions[keyof BodyParserOptions];

export type ParsedTextBody = string;
export type ParsedJsonBody = unknown;

export type ParsedRequestBody = ParsedTextBody | ParsedJsonBody;

export function defaultBodyParserOptions(
    options: Partial<BodyParserOptions>
): BodyParserOptions {
    return {
        text: {
            limit: options.text?.limit || 1000000,
            contentTypes:
                options.text?.contentTypes ||
                new Set(["text/plain", "text/html"]),
            encoding: "utf-8",
        },
        json: {
            limit: options.json?.limit || 1000000,
            contentTypes:
                options.json?.contentTypes || new Set(["application/json"]),
            encoding: "utf-8",
            convertEmptyStringsToNull: true,
        },
    };
}

/**
 * The body parser is used by the request to collect and parse the body. It
 * should also validate it.
 */
export abstract class BodyParser {
    readonly contentType: BodyParserContentType;
    protected readonly contentTypeOptions: ContentTypeOptions;

    protected parsedBody: ParsedRequestBody | undefined;

    constructor(
        protected readonly options: BodyParserOptions,
        contentTypeHeader: string | undefined
    ) {
        this.contentType = this.getRequestContentType(contentTypeHeader);
        this.contentTypeOptions = this.getContentTypeOptions();
    }

    protected abstract handleTextRequest(): Promise<ParsedTextBody>;
    protected abstract handleJsonRequest(): Promise<ParsedJsonBody>;

    async body(): Promise<ParsedRequestBody> {
        if (this.parsedBody) return this.parsedBody;

        switch (this.contentType) {
            case BodyParserContentType.Text:
                this.parsedBody = await this.handleTextRequest();
                break;
            case BodyParserContentType.Json:
                this.parsedBody = await this.handleJsonRequest();
                break;
        }

        return this.parsedBody;
    }

    protected getRequestContentType(
        contentType: string | undefined
    ): BodyParserContentType {
        if (!contentType) return BodyParserContentType.Text;

        if (this.options.json.contentTypes.has(contentType)) {
            return BodyParserContentType.Json;
        }

        return BodyParserContentType.Text;
    }

    protected getContentTypeOptions(): ContentTypeOptions {
        switch (this.contentType) {
            case BodyParserContentType.Text:
                return this.options.text;
            case BodyParserContentType.Json:
                return this.options.json;
        }
    }

    protected createMissingContentLengthError(): HttpError {
        return new HttpError(
            statusCodes.LengthRequired,
            "The Content-Length header is required!"
        );
    }

    protected createMissmatchedContentLengthError(): HttpError {
        return new HttpError(
            statusCodes.UnprocessableContent,
            "Missmatched Content-Length header and actual body content length!"
        );
    }

    protected createBodyTooBigError(): HttpError {
        return new HttpError(
            statusCodes.UnprocessableContent,
            "The body is too large!"
        );
    }
}

