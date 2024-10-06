import { RouteBuilderContext } from "./builders/context.js";
import {
    MiddlewareContext,
    MiddlewareOrBefore,
} from "./middlware/middleware.js";
import { buildNextMiddlewareFunctions } from "./nextFunctionsBuilder.js";
import { Method } from "./router/router.js";
import { HandlerFunction, HandlerFunctionArguments } from "./types/handler.js";
import { ParserFunctions } from "./types/parser.js";
import { Path } from "./types/path.js";

export class Route {
    constructor(
        readonly path: Path,
        readonly method: Method | null,
        public parsers: ParserFunctions,
        private readonly handler: HandlerFunction<RouteBuilderContext>,
        public middleware: MiddlewareOrBefore[]
    ) {}

    async handleRequest(params: HandlerFunctionArguments<RouteBuilderContext>) {
        const context: MiddlewareContext = {
            request: params.request,
            response: params.response,
        };

        const lastHandler = () =>
            this.handler({
                request: params.request,
                response: params.response,
            });

        const handler = buildNextMiddlewareFunctions(
            context,
            lastHandler,
            this.middleware
        );

        await handler();
    }
}

