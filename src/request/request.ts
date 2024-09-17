import { Locals } from "../middlware/middleware.js";
import { Method } from "../router.js";
import { ParsedParsers } from "../types/parser.js";
import { Path } from "../types/path.js";
import { Validators } from "../validate.js";
import { Cookies } from "./cookies.js";
import { QueryParams } from "./queryParams.js";

export abstract class Request<
    R extends Path | null,
    M extends Method[] | unknown,
    P extends ParsedParsers,
    L extends Locals,
    V extends Validators,
> {
    /**
     * The url params with thire types after the parsers.
     *
     * @example
     *     router
     *         .get("/users/:id/*?")
     *         .parse({ id: intParser })
     *         .handle(({ request, response }) => {
     *             request.params; // { id: number, wildcard: string | undefined }
     *         });
     */
    abstract readonly params: P;

    /**
     * The url of the request. Don't use this to get query params, instead use
     * the `query` property of this request.
     */
    abstract readonly url: URL;

    /**
     * The path specified for this route in the router.
     *
     * @example
     *     router.get("/users/:id").handle(({ request, response }) => {
     *         request.routerPath; // "/users/:id"
     *     });
     */
    abstract readonly routerPath: R;

    /** The http method used to make the request. It can be non standard. */
    abstract readonly method: M extends Method[] ? M[number] : Method;

    /** The headers sent with the request */
    abstract readonly headers: Record<string, string>;

    /**
     * The url query params from the request
     *
     * @example
     *     request.query.get("id"); // Get one query param
     *     request.query.all(); // Get all query params
     *
     * @see {@link QueryParams}
     */
    abstract readonly query: QueryParams<V["query"]>;

    /** The locals passed from previous before functions */
    abstract locals: L;

    /**
     * Readonly cookies from the incomming request. To send cookies with the
     * response use the `response` object.
     *
     * @example
     *     request.cookies.get("session"); // string | undefined
     *     request.cookies.all(); // Map<string, string>
     *
     * @example
     *     router.get("/").handle(({ request, response }) => {
     *         const welcommedBefore =
     *             request.cookies.get("welcommed") !== undefined;
     *         response.cookie("welcommed", "true");
     *
     *         return response.ok().json({
     *             message: welcommedBefore
     *                 ? "Hello again!"
     *                 : "Welcome to my site!",
     *         });
     *     });
     */
    abstract readonly cookies: Cookies;

    /** The value of the `Content-Type` header on the request */
    abstract readonly contentType: string | undefined;

    /** The path comming from the request before being parsed by {@link URL} */
    abstract readonly requestedPath: string;

    abstract get requestBodyEnded(): boolean;

    abstract body(): Promise<string>;

    async json(): Promise<unknown> {
        const body = await this.body();

        return JSON.parse(body);
    }
}

