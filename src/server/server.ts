import { Method, RouteGroup } from "../router.js";
import { Request } from "../request/request.js";
import { Response } from "../response/response.js";
import { Path } from "../types/path.js";
import { Route } from "../route.js";
import { ParsedParsers } from "../types/parser.js";
import {
    Locals,
    MiddlewareContext,
    MiddlewareOrBefore,
} from "../middlware/middleware.js";
import { Validators } from "../validate.js";
import { HttpError } from "../error.js";
import { statusCodes } from "../response/statusCode.js";
import { buildNextMiddlewareFunctions } from "../nextFunctionsBuilder.js";

export type Port = number;

export interface ServerOptions {
    port: Port;
    host?: string;
}

export type UseServerFunction = (
    rootRouteGroup: RouteGroup,
    routerMiddleware: MiddlewareOrBefore[],
    options: ServerOptions
) => Server;

export abstract class Server {
    protected readonly port: Port;
    protected readonly host: string;

    constructor(
        protected rootRouteGroup: RouteGroup,
        protected routerMiddleware: MiddlewareOrBefore[],
        options: ServerOptions
    ) {
        this.port = options.port;
        this.host = options.host || "localhost";
    }

    abstract listen(): never;

    async getRequestedRoute(
        path: Path,
        method: Method
    ): Promise<[Route, Record<string, unknown>] | undefined> {
        const routeAndParams = this.rootRouteGroup.getRouteFromPath(
            path,
            method
        );

        if (!routeAndParams) return undefined;

        return [routeAndParams.route, routeAndParams.params];
    }

    protected async handleRequest(
        request: Request<
            Path | null,
            Method[] | unknown,
            ParsedParsers,
            Locals,
            Validators
        >,
        response: Response<Path | null, Method[] | unknown>,
        route: Route | undefined
    ): Promise<void> {
        const context: MiddlewareContext = {
            request: request,
            response: response,
        };

        if (!route) {
            await this.handleRouteNotFoundRequest(context);

            return;
        }

        const lastHandler = () =>
            route!.handleRequest({
                request: request as Request<
                    Path,
                    Method[] | unknown,
                    ParsedParsers,
                    Locals,
                    Validators
                >,
                response: response,
            });

        const handler = buildNextMiddlewareFunctions(
            context,
            lastHandler,
            route.middleware
        );

        await this.tryOrPopulateErrorResponse(handler, response);
        await this.startStreamOrEndResponse(response);
    }

    private async handleRouteNotFoundRequest(
        context: MiddlewareContext
    ): Promise<void> {
        let lastHandler = () => {
            throw new HttpError(
                statusCodes.NotFound,
                JSON.stringify({
                    message: "Not found!",
                })
            );
        };

        const handle = buildNextMiddlewareFunctions(
            context,
            lastHandler,
            this.routerMiddleware
        );

        await this.tryOrPopulateErrorResponse(handle, context.response);
        await this.startStreamOrEndResponse(context.response);
    }

    private async tryOrPopulateErrorResponse(
        fn: () => Promise<void> | void,
        response: Response<Path | null, Method[] | unknown>
    ) {
        try {
            await fn();
        } catch (err) {
            if (err instanceof HttpError) {
                response.status(err.status).json(err.toResponseJson());

                return;
            }

            console.error(err);

            response.status(statusCodes.InternalServerError).json({
                message: "Internal server error!",
            });
        }
    }

    private async startStreamOrEndResponse(
        response: Response<Path | null, Method[] | unknown>
    ) {
        if (response.responseStream) {
            await this.tryOrPopulateErrorResponse(
                () => response.responseStream!._start(),
                response
            );

            return;
        }

        response._endAndSendContent();
    }
}

