import { Path } from "../types/path.js";
import { Server, UseServerFunction, ServerOptions } from "./server.js";
import http from "node:http";
import { NodeRequest } from "../request/nodeRequest.js";
import { NodeResponse } from "../response/nodeResponse.js";
import { MiddlewareOrBefore } from "../middlware/middleware.js";
import { Router } from "../router/router.js";
import { NodeBodyParser } from "../request/nodeBodyParser.js";

export const useNodeServer: UseServerFunction = (
    router: Router,
    routerMiddleware: MiddlewareOrBefore[],
    options: ServerOptions
) => new NodeServer(router, routerMiddleware, options);

export class NodeServer extends Server {
    override listen(): never {
        const server = http.createServer((request, response) =>
            this.transformAndHandle(request, response)
        );

        return server.listen(this.port, this.host) as never;
    }

    private requestedUrlToUrl(requestedUrl: string): URL {
        return new URL(requestedUrl, `localhost://${this.host}:${this.port}`);
    }

    private async transformAndHandle(
        request: http.IncomingMessage,
        response: http.ServerResponse
    ): Promise<void> {
        if (!request.url || !request.method) {
            response.end();

            return;
        }

        const url = this.requestedUrlToUrl(request.url);
        const routeAndParams = await this.getRequestedRoute(
            url.pathname as Path,
            request.method
        );

        const route = routeAndParams ? routeAndParams[0] : undefined;
        const params = routeAndParams ? routeAndParams[1] : {};

        const bodyParser = new NodeBodyParser(request, this.bodyParserOptions);

        const parsedRequest = new NodeRequest(
            request,
            bodyParser,
            params,
            {},
            route?.path || null,
            url
        );

        const parsedResponse = new NodeResponse(response);

        await this.handleRequest(parsedRequest, parsedResponse, route);
    }
}

