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
import { Validators } from "./validate.js";

export class Route {
    constructor(
        readonly path: Path,
        readonly method: Method | null,
        public parsers: ParserFunctions,
        private readonly handler: HandlerFunction<
            Path,
            Method[] | null,
            NonNullable<unknown>,
            NonNullable<unknown>,
            Validators
        >,
        public middleware: MiddlewareOrBefore[]
    ) {}

    async handleRequest(
        params: HandlerFunctionArguments<
            Path,
            Method[] | null,
            NonNullable<unknown>,
            NonNullable<unknown>,
            Validators
        >,
        logErrors: boolean
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
                        middleware.middleware(context, nextFunctions[i]!)
                    )
                );
            } else if (middleware.type === "Before") {
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

                    await nextFunctions[i]!();
                });
            } else if (middleware.type === "Validator") {
                nextFunctions.push(async () => {
                    if (middleware.validatorType === "body") {
                        const validated = await middleware.validator(
                            await context.request.json()
                        );
                        if (!validated.success) {
                            context.response.unprocessableContent().json({
                                errors: validated.errors,
                            });

                            return;
                        }

                        context.request.validatedJsonBody = validated.data;
                    } else if (middleware.validatorType === "query") {
                        const validated = await middleware.validator(
                            context.request.query.toObject()
                        );
                        if (!validated.success) {
                            context.response.unprocessableContent().json({
                                errors: validated.errors,
                            });

                            return;
                        }

                        context.request.query.validated = validated.data;
                    }

                    await nextFunctions[i]!();
                });
            }
        }

        try {
            await nextFunctions.at(-1)!();
        } catch (err) {
            if (err instanceof HttpError) {
                if (!context.response.stream) {
                    context.response
                        .status(err.status)
                        .json(err.toResponseJson());
                }

                return;
            }

            if (logErrors) {
                console.error(err);
            }

            if (!context.response.stream) {
                context.response.internalServerError().json({
                    message: "Internal server error!",
                });
            }
        }
    }
}

