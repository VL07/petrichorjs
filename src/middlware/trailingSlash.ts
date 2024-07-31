import { Middleware } from "../builders.js";
import { RedirectStatusCode, statusCodes } from "../response.js";
import { middleware } from "./middleware.js";

interface TrailingSlashMiddlewareConfig {
    trailingSlash: boolean;
    statusCode: RedirectStatusCode;
    keepTrailingQuestionmark: boolean;
}

function trailingSlashConfigOrDefault(
    config: Partial<TrailingSlashMiddlewareConfig>
): TrailingSlashMiddlewareConfig {
    return {
        trailingSlash: config.trailingSlash || false,
        statusCode: config.statusCode || statusCodes.MovedPermanently,
        keepTrailingQuestionmark: config.keepTrailingQuestionmark || false,
    };
}

/**
 * Depending on the configuration this middleware can remove or add trailing
 * slashes, hashes and questionmarks on the requested url. If the requested url
 * dosn't match the configuration this middleware will redirect to how the
 * correct url is.
 *
 * @example
 *     router.use(
 *         trailingSlash({
 *             trailingSlash: false, // Boolean, defaults to false. To add trailing slashes or not, true will add and false will remove.
 *             statusCode: statusCodes.MovedPermanently, // RedirectStatusCode, defaults to 308. The status code the redirect is done with.
 *             keepTrailingQuestionmark: false, // Boolean, default to false. Same as keepTrailingHash but for trailing questionmarks.
 *         })
 *     );
 */
export function trailingSlash(
    config?: Partial<TrailingSlashMiddlewareConfig>
): Middleware {
    const parsedConfig = trailingSlashConfigOrDefault(config || {});

    return middleware(async ({ request, response }, next) => {
        const path = request.requestedPath;
        const url = request.url;

        let correctPath =
            request.url.pathname === "/"
                ? url.pathname
                : parsedConfig.trailingSlash
                  ? !url.pathname.endsWith("/")
                      ? url.pathname + "/"
                      : url.pathname
                  : url.pathname.endsWith("/")
                    ? url.pathname.slice(0, -1)
                    : url.pathname;

        correctPath += !url.search
            ? parsedConfig.keepTrailingQuestionmark && path.includes("?")
                ? "?"
                : ""
            : url.search;

        correctPath += request.url.hash;

        if (correctPath !== path) {
            response.redirect(parsedConfig.statusCode, correctPath);

            return;
        }

        await next();
    });
}
