import { HttpError } from "../error.js";
import { Locals } from "../middlware/middleware.js";
import { statusCodes } from "../response/statusCode.js";
import { Method } from "../router/router.js";
import { ParsedParsers } from "../types/parser.js";
import { Path } from "../types/path.js";
import { Validators } from "../validate.js";
import { ParsedJsonBody, ParsedTextBody } from "./bodyParser.js";
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

    /**
     * Awaits the request body and parses it. The parsed body is not checked to
     * match a specific type, unlike how {@link Request.text} or
     * {@link Request.json} does it.
     *
     * @example
     *     await request.body();
     */
    abstract body(): Promise<unknown>;

    /**
     * Awaits and parses the request body, like {@link Request.body}, but in this
     * case it also checks to make sure the request content type is of the right
     * type.
     *
     * @example
     *     const body = await request.text();
     */
    abstract text(): Promise<ParsedTextBody>;

    /**
     * Awaits and parses the request body, like {@link Request.body}, but in this
     * case it also checks to make sure the request content type is of the right
     * type. It also parses the json to an object.
     *
     * @example
     *     const body = await request.json();
     */
    abstract json(): Promise<ParsedJsonBody>;

    protected createInvalidContentTypeError(): HttpError {
        return new HttpError(
            statusCodes.UnsupportedMediaType,
            "Invalid content type!"
        );
    }
}

