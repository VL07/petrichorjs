import { intParser } from "./parsers.js";
import { Router } from "./router.js";

const router = new Router();
router.get("/").handle(({ request, response }) => {
    response.html("<h1>Welcome!</h1>");
});

router
    .get("/id")
    .post()
    .use((context, next) => {
        console.log("middleware", context.request.url);
        next();
    })
    .handle(({ request, response }) => {
        const id = request.query.getAndParse("id", intParser);
        response.html(`<h1>Id: ${id}</h1>`);
    });

router
    .get("/users/:id")
    .parse({
        id: intParser,
    })
    .handle(({ request, response }) => {
        response.html(`<h1>Userid: ${request.params.id}</h1>`);
    });

router.all("/*?").handle(({ request, response }) => {
    response.status(404).html(`
        <h1>Not found!</h1>
        <p>The page <code>${request.params.wildcard || "/"}</code> could not be found!</p>
    `);
});

router
    .get("/stream")
    .use(async (context, next) => {
        console.log("Middleware 1 start");
        await next();
        console.log("Middleware 1 end");
    })
    .use(async ({ response }, next) => {
        console.log("Middleware 2 start");
        await next();
        if (response.stream) {
            response.stream.onData((chunk) => {
                console.log(chunk);
            });
        }
        console.log("Middleware 2 end");
    })
    .handle(({ request, response }) => {
        console.log("handler start");
        const start = request.query.getAndParse("start", intParser);
        console.log("start", start);

        if (start > 100) {
            return response.json({
                message: "Start to large!",
            });
        }

        response.streamResponse(async (stream) => {
            let i = start;
            while (i < 100) {
                await stream.write(`N: ${i}\n`);
                await stream.sleep(100);

                i++;
            }

            await stream.close();
        });

        console.log("handler end");
    });

router.listen(3333);
