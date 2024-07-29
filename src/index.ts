import { Router } from "./router.js";

const router = new Router();
router.get("/").handle(({ request, response }) => {
    response.html("<h1>Welcome!</h1>");
});

router.all("/*?").handle(({ request, response }) => {
    response.status(404).html(`
        <h1>Not found!</h1>
        <p>The page <code>${request.params.wildcard || "/"}</code> could not be found!</p>
    `);
});

router.listen(3333);
