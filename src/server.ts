import http from "node:http";
import { Path, RouteGroup } from "./router.js";
import { Request } from "./request.js";
import { Response } from "./response.js";
import {
    MiddlewareContext,
    MiddlewareOrBefore,
    NextFunction,
} from "./builders.js";
import { HttpError } from "./error.js";

export class Server {
    private readonly server: http.Server;

    constructor(
        private readonly baseRouteGroup: RouteGroup,
        readonly host: string,
        readonly port: number,
        readonly routerMiddleware: MiddlewareOrBefore[]
    ) {
        this.server = http.createServer((request, response) =>
            this.requestHandler(request, response)
        );
    }

    listen(): void {
        this.server.listen(this.port, this.host);
    }

    private async requestHandler(
        request: http.IncomingMessage,
        response: http.ServerResponse
    ): Promise<void> {
        if (!request.url || !request.method) {
            response.writeHead(400).end();
            return;
        }

        const url = new URL(
            request.url || "/",
            `http://${this.host}:${this.port}`
        );

        const route = this.baseRouteGroup.getRouteFromPath(
            url.pathname as Path,
            request.method
        );

        const parsedResponse = new Response(this, response);

        if (!route) {
            const parsedRequest = new Request(this, request, {}, {}, null);

            const context: MiddlewareContext = {
                request: parsedRequest,
                response: parsedResponse,
            };

            const tryOrPopulateErrorResponse = async (
                fn: () => Promise<void> | void
            ) => {
                try {
                    await fn();
                } catch (err) {
                    if (err instanceof HttpError) {
                        context.response
                            .status(err.status)
                            .json(err.toResponseJson());

                        return;
                    }

                    throw err;
                }
            };

            const nextFunctions: NextFunction[] = [
                () =>
                    context.response.notFound().json({
                        message: "Not found!",
                    }),
            ];
            for (const [i, middleware] of this.routerMiddleware.entries()) {
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
                                ...((await middleware.before(
                                    context.request
                                )) || {}),
                            };
                        } catch (err) {
                            if (err instanceof HttpError) {
                                context.response
                                    .status(err.status)
                                    .json(err.toResponseJson());

                                return;
                            }

                            throw err;
                        }

                        await nextFunctions[i]!();
                    });
                }
            }

            await nextFunctions.at(-1)!();

            if (parsedResponse.stream) {
                await parsedResponse.stream.start();
            } else {
                response.end(parsedResponse.content);
            }

            return;
        }

        const parsedRequest = new Request(
            this,
            request,
            route.params,
            {},
            route.route.path
        );

        await route.route.handleRequest({
            request: parsedRequest,
            response: parsedResponse,
        });

        if (parsedResponse.stream) {
            await parsedResponse.stream.start();
        } else {
            response.end(parsedResponse.content);
        }
    }
}

