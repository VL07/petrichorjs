import { intParser } from "./parsers.js";
import { Router } from "./router.js";

const router = new Router();
// router.get("/").handle(({ request, response }) => {
//     response.html("<h1>Welcome!</h1>");
// });

router.get("/").handle(({ request, response }) => {
    const welcommedBefore = request.cookies.get("welcommed") !== undefined;
    response.cookie("welcommed", "true");

    return response.ok().json({
        message: welcommedBefore ? "Hello again!" : "Welcome to my site!",
    });
});

router.get("/protected").handle(({ request, response }) => {
    const to = decodeURI(request.query.get("to") || "");
    response.redirect(303, to || "/");
});

router
    .group("/")
    .before((request) => {
        console.log("in before 1");
        return {
            url: request.url.toString(),
        };
    })
    .use(async (context, next) => {
        console.log("middleware 1 start");
        await next();
        console.log("middleware 1 end");
    })
    .handle()
    .get("/id")
    .post()
    .use(async (context, next) => {
        console.log("middleware 2 start");
        await next();
        console.log("middleware 2 end");
    })
    .before((request) => {
        console.log("in before 2");
    })
    .handle(({ request, response }) => {
        console.log("locals url: ", request.locals.url);
        const id = request.query.getAndParse("id", intParser);
        response.html(`<h1>Id: ${id}</h1>`);
    });

// router
//     .get("/users/:id")
//     .parse({
//         id: intParser,
//     })
//     .handle(({ request, response }) => {
//         response.html(`<h1>Userid: ${request.params.id}</h1>`);
//     });

router.all("/*?").handle(({ request, response }) => {
    response.notFound().html(`
        <h1>Not found!</h1>
        <p>The page <code>${request.params.wildcard || "/"}</code> could not be found!</p>
    `);
});

// router
//     .get("/stream")
//     .use(async (context, next) => {
//         console.log("Middleware 1 start");
//         await next();
//         console.log("Middleware 1 end");
//     })
//     .use(async ({ response }, next) => {
//         console.log("Middleware 2 start");
//         await next();
//         if (response.stream) {
//             response.stream.onData((chunk) => {
//                 console.log(chunk);
//             });
//         }
//         console.log("Middleware 2 end");
//     })
//     .handle(({ request, response }) => {
//         console.log("handler start");
//         const start = request.query.getAndParse("start", intParser);
//         console.log("start", start);

//         if (start > 100) {
//             return response.json({
//                 message: "Start to large!",
//             });
//         }

//         response.streamResponse(async (stream) => {
//             let i = start;
//             while (i < 100) {
//                 await stream.write(`N: ${i}\n`);
//                 await stream.sleep(100);

//                 i++;
//             }

//             await stream.close();
//         });

//         console.log("handler end");
//     });

router.listen(3333);
