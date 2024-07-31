import {
    HandlerFunction,
    HandlerFunctionArguments,
    MiddlewareContext,
    MiddlewareOrBefore,
    NextFunction,
    ParserFunctions,
} from "./builders.js";
import { HttpError } from "./error.js";
import type { Method, Path } from "./router.js";

export class Route {
    constructor(
        readonly path: Path,
        readonly method: Method | null,
        public parsers: ParserFunctions,
        private readonly handler: HandlerFunction<
            Path,
            Method[] | null,
            NonNullable<unknown>,
            NonNullable<unknown>
        >,
        public middleware: MiddlewareOrBefore[]
    ) {}

    async handleRequest(
        params: HandlerFunctionArguments<
            Path,
            Method[] | null,
            NonNullable<unknown>,
            NonNullable<unknown>
        >
    ) {
        const tryOrPopulateErrorResponse = async (
            fn: () => Promise<void> | void
        ) => {
            try {
                await fn();
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

        const nextFunctions: NextFunction[] = [
            () =>
                tryOrPopulateErrorResponse(() =>
                    this.handler({
                        request: params.request,
                        response: params.response,
                    })
                ),
        ];
        for (const [i, middleware] of this.middleware.entries()) {
            if (middleware.type === "Middleware") {
                nextFunctions.push(() =>
                    tryOrPopulateErrorResponse(() =>
                        middleware.middleware(context, nextFunctions[i])
                    )
                );
            } else {
                nextFunctions.push(async () => {
                    try {
                        context.request.locals = {
                            ...context.request.locals,
                            ...((await middleware.before(context.request)) ||
                                {}),
                        };
                    } catch (err) {
                        if (err instanceof HttpError) {
                            params.response
                                .status(err.status)
                                .json(err.toResponseJson());

                            return;
                        }

                        throw err;
                    }

                    await nextFunctions[i]();
                });
            }
        }

        await nextFunctions.at(-1)!();
    }
}
