// import http from "http";
// import type {
//     Method,
//     Params,
//     Path,
//     Route,
//     WhereClauseFunction,
// } from "./router.js";

// interface RoutePath<R extends Path, M extends Method> {
//     path: R;
//     method: M;
//     handler: Route<R, M>;
// }

// interface DynamicSlug {
//     dynamicSlugName: string;
//     whereClauseFunction: WhereClauseFunction<unknown>;
//     slug: Slug;
// }

// interface Slug {
//     slug: string;
//     slugChildern: Map<string, Slug>;
//     dynamicSlugChildern: DynamicSlug[];
//     routesChildren: Map<Method, RoutePath<Path, Method>>;
// }

// export class Server {
//     private readonly server: http.Server;

//     constructor(
//         private readonly routes: Slug,
//         private readonly port: number
//     ) {
//         this.server = http.createServer(this.requestHandler);
//         this.server.listen(port, "localhost");
//     }

//     private async requestHandler(
//         request: http.IncomingMessage,
//         response: http.ServerResponse
//     ): Promise<void> {}

//     private findRouteHandler<M extends Method>(
//         method: M,
//         routePath: Path,
//         parentSlugGroup: Slug,
//         params: Record<string, string | undefined>
//     ):
//         | {
//               route: Route<Path, Method>;
//               params: Record<string, string | undefined>;
//           }
//         | undefined {
//         if (routePath === "/") {
//             const route = parentSlugGroup.routesChildren.get(method);
//             return (
//                 route && {
//                     route: route.handler,
//                     params: params,
//                 }
//             );
//         }

//         const slugEndIndex = routePath.slice(1).indexOf("/");
//         const slug = routePath.slice(1, slugEndIndex);

//         const slugGroup = parentSlugGroup.slugChildern.get(slug);
//         if (slugGroup) {
//             return this.findRouteHandler(
//                 method,
//                 `/${routePath.slice(slugEndIndex + 1)}`,
//                 slugGroup,
//                 params
//             );
//         }

//         for (const dynamicSlug of parentSlugGroup.dynamicSlugChildern) {
//             const slugValid = dynamicSlug.whereClauseFunction(slug);
//             if (!slugValid) continue;

//             const route = this.findRouteHandler(
//                 method,
//                 `/${routePath.slice(slugEndIndex + 1)}`,
//                 dynamicSlug.slug,
//                 { ...params, [dynamicSlug.dynamicSlugName]: slug }
//             );
//             if (route) return route;
//         }

//         return undefined;
//     }
// }
