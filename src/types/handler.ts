import { Method } from "../router.js";
import { Validators } from "../validate.js";
import { DefaultOrParsedParams, ParsedParsers } from "./parser.js";
import { Path } from "./path.js";
import { Request } from "../request.js";
import { Response } from "../response.js";
import { Locals } from "../middlware/middleware.js";

export type HandlerFunctionArguments<
    R extends Path,
    M extends Method[] | null,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> = {
    request: Request<R, M, DefaultOrParsedParams<R, P>, L, V>;
    response: Response<R, M>;
};

/** Handles the requests */
export type HandlerFunction<
    R extends Path,
    M extends Method[] | null,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> = (data: HandlerFunctionArguments<R, M, P, L, V>) => void | Promise<void>;

