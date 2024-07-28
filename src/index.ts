import { Router } from "./router.js";

const router = new Router();
// router.get("/").handle(() => {});
// router.get("/:id").handle(() => {});
// router.post("/:id?").handle(() => {});
// router.get("/*").handle(() => {});
// router.on("DELETE", "/delete/*").handle(() => {});
// router.post("/*?").handle(() => {});
// router.get("/users/:id/posts/:postId/*").handle(() => {});
router
    .get("/:a/:b")
    .get()
    .post()
    .parse({
        a: (param) => parseInt(param),
    })
    .handle((params) => {
        params;
    });

const userGroup = router
    .group("/users/:userId")
    .parse({
        userId: (param) => parseInt(param),
    })
    .handle();

userGroup.get("/").handle((params) => {});
userGroup
    .get("/comments/:commentId")
    .parse({
        commentId: (param) => parseInt(param),
    })
    .handle((params) => {});
// router.ALL("/users/:id/posts/:postId/*").handle(() => {});

const groups = router.listen(8080);
console.log("testing");
console.log(groups.getRouteFromPath("/a/b", "GET"));
console.log(groups.getRouteFromPath("/1/b", "POST"));
console.log(groups.getRouteFromPath("/users/1", "GET"));
console.log(groups.getRouteFromPath("/users/1/comments/2", "GET"));
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
