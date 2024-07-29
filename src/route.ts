import {
    HandlerFunction,
    HandlerFunctionArguments,
    Middleware,
    MiddlewareContext,
    NextFunction,
    Parsed,
    ParserFunctions,
} from "./builders.js";
import { HttpError, UnparseableError } from "./error.js";
import type { Method, Path } from "./router.js";

export class Route {
    constructor(
        readonly path: Path,
        readonly method: Method | null,
        public parsers: ParserFunctions,
        private readonly handler: HandlerFunction<Path, Method[] | null, any>,
        readonly middleware: Middleware[]
    ) {}

    async handleRequest(
        params: HandlerFunctionArguments<Path, Method[] | null, any>
    ) {
        const handleHandler = () => {
            try {
                this.handler(params);
            } catch (err) {
                if (err instanceof HttpError) {
                    params.response
                        .status(err.status)
                        .json(err.toResponseJson());

                    return;
                }

                throw err;
            }
        };

        const context: MiddlewareContext = {
            request: params.request,
            response: params.response,
        };

        const nextFunctions: NextFunction[] = [() => handleHandler()];
        for (const [i, middleware] of this.middleware.entries()) {
            nextFunctions.push(() => middleware(context, nextFunctions[i]));
        }

        await nextFunctions.at(-1)!();
    }
}
