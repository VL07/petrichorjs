import { HttpError } from "../error.js";
import { statusCodes } from "../response/statusCode.js";

/** The options for body parsers */
export type BodyParserOptions = {
    /** Request body max size in bytes */
    limit: number;
};

export function defaultBodyParserOptions(
    options: Partial<BodyParserOptions>
): BodyParserOptions {
    return {
        limit: options.limit || 1000000,
    };
}

/**
 * The body parser is used by the request to collect and parse the body. It
 * should also validate it.
 */
export abstract class BodyParser {
    constructor(protected options: BodyParserOptions) {}

    abstract body(): Promise<string>;

    async json(): Promise<unknown> {
        const body = await this.body();

        return JSON.parse(body);
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

