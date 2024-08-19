import { DefaultOrParsedParams } from "./parser.js";
import { Request } from "../request.js";
import { Response } from "../response.js";
import { RouteBuilderContext } from "../builders/context.js";

export type HandlerFunctionArguments<C extends RouteBuilderContext> = {
    request: Request<
        C["path"],
        C["method"],
        DefaultOrParsedParams<C["path"], C["parsed"]>,
        C["locals"],
        C["validators"]
    >;
    response: Response<C["path"], C["method"]>;
};

/** Handles the requests */
export type HandlerFunction<C extends RouteBuilderContext> = (
    data: HandlerFunctionArguments<C>
) => void | Promise<void>;

