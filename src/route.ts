import {
    HandlerFunction,
    HandlerFunctionArguments,
    Middleware,
    MiddlewareContext,
    MiddlewareOrBefore,
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
        private readonly handler: HandlerFunction<
            Path,
            Method[] | null,
            any,
            any
        >,
        public middleware: MiddlewareOrBefore[]
    ) {}

    async handleRequest(
        params: HandlerFunctionArguments<Path, Method[] | null, any, any>
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

        console.log(this.middleware);

        const nextFunctions: NextFunction[] = [() => handleHandler()];
        for (const [i, middleware] of this.middleware.entries()) {
            if (middleware.type === "Middleware") {
                nextFunctions.push(() =>
                    middleware.middleware(context, nextFunctions[i])
                );
            } else {
                nextFunctions.push(async () => {
                    context.request.locals = {
                        ...context.request.locals,
                        ...((await middleware.before(context.request)) || {}),
                    };
                    nextFunctions[i]();
                });
            }
        }

        await nextFunctions.at(-1)!();
    }
}
