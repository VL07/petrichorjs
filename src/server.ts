import http from "http";
import { Path, RouteGroup } from "./router.js";
import { Request } from "./request.js";
import { Response } from "./response.js";
import { UnparseableError } from "./error.js";

export class Server {
    private readonly server: http.Server;

    constructor(
        private readonly baseRouteGroup: RouteGroup,
        readonly host: string,
        readonly port: number
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

        if (!route) {
            response.writeHead(404).end();
            return;
        }

        const parsedRequest = new Request(this, request, route?.params);
        const parsedResponse = new Response(this, response);

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
