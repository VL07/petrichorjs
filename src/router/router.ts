import { Route } from "../route.js";
import { Method } from "../router.js";
import { Path } from "../types/path.js";

export abstract class Router {
    abstract setRoute(path: Path, route: Route): void;

    abstract getRoute(
        path: Path,
        method: Method
    ): [Route, Record<string, unknown>] | undefined;
}

