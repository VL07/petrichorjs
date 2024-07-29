import {
    HandlerFunction,
    HandlerFunctionArguments,
    ParserFunctions,
} from "./builders.js";
import type { Method, Path } from "./router.js";

export class Route {
    constructor(
        readonly path: Path,
        readonly method: Method | null,
        public parsers: ParserFunctions,
        private readonly handler: HandlerFunction<Path, Method[] | null, any>
    ) {}

    async handleRequest(
        params: HandlerFunctionArguments<Path, Method[] | null, any>
    ) {
        await this.handler(params);
    }
}
