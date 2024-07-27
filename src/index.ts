import { Router } from "./router.js";

const router = new Router();
console.log("here");
// router.get("/").handle(() => {});
// router.get("/:id").handle(() => {});
// router.post("/:id?").handle(() => {});
// router.get("/*").handle(() => {});
// router.on("DELETE", "/delete/*").handle(() => {});
// router.post("/*?").handle(() => {});
// router.get("/users/:id/posts/:postId/*").handle(() => {});
router
    .get("/:a?")
    .post()
    .parse({
        a: (param) => {
            if (param === "no") return null;
            return param;
        },
    })
    .handle(() => {});
// router.ALL("/users/:id/posts/:postId/*").handle(() => {});

const groups = router.listen(8080);
console.log("testing");
console.log(groups.getRouteFromPath("/", "GET"));
console.log(groups.getRouteFromPath("/no2", "POST"));
console.log(groups.getRouteFromPath("/", "DELETE"));
// console.log(groups.getRouteFromPath("/123", "GET"));
// console.log(groups.getRouteFromPath("/123/abc", "GET"));
// console.log(groups.getRouteFromPath("/", "POST"));
// console.log(groups.getRouteFromPath("/users/123/posts/post123", "GET"));
// console.log(
//     groups.getRouteFromPath("/users/123/posts/post123/comments", "GET")
// );
// console.log(
//     groups.getRouteFromPath("/users/123/posts/post123/comments/352", "DELETE")
// );
// console.log(groups.getRouteFromPath("/delete/users/133", "DELETE"));
