import { HttpError } from "./error.js";
import {
    MiddlewareContext,
    MiddlewareOrBefore,
} from "./middlware/middleware.js";
import { statusCodes } from "./response/statusCode.js";

type NextFunction = () => Promise<void> | void;

export function buildNextMiddlewareFunctions(
    context: MiddlewareContext,
    last: NextFunction,
    middlewareBefore: MiddlewareOrBefore[]
): NextFunction {
    let nextFunctions = [last];

    for (const [i, middleware] of middlewareBefore.entries()) {
        if (middleware.type === "Middleware") {
            nextFunctions.push(() =>
                middleware.middleware(context, nextFunctions[i]!)
            );
        } else if (middleware.type === "Before") {
            nextFunctions.push(async () => {
                context.request.locals = {
                    ...context.request.locals,
                    ...((await middleware.before(context.request)) || {}),
                };

                await nextFunctions[i]!();
            });
        } else if (middleware.type === "Validator") {
            if (middleware.validatorType === "body") {
                nextFunctions.push(async () => {
                    const validated = await middleware.validator(
                        await context.request.json()
                    );
                    if (!validated.success) {
                        throw new HttpError(
                            statusCodes.UnprocessableContent,
                            JSON.stringify({ errors: validated.errors })
                        );
                    }

                    await nextFunctions[i]!();
                });
            } else if (middleware.validatorType === "query") {
                nextFunctions.push(async () => {
                    const validated = await middleware.validator(
                        await context.request.query.toObject()
                    );
                    if (!validated.success) {
                        throw new HttpError(
                            statusCodes.UnprocessableContent,
                            JSON.stringify({ errors: validated.errors })
                        );
                    }

                    await nextFunctions[i]!();
                });
            }
        }
    }

    return nextFunctions.at(-1)!;
}

