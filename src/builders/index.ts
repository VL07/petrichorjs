import { Route } from "../route.js";

export interface BuildableToRoutes {
    build(): Route[];
}

