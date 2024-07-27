import { Router } from "./router.js";

const router = new Router();
console.log("here");
router.GET("/").handle(() => {});
router.GET("/:id").handle(() => {});
router.POST("/:id?").handle(() => {});
router.GET("/*").handle(() => {});
router.POST("/*?").handle(() => {});
router.GET("/users/:id/posts/:postId/*").handle(() => {});
router.listen(8080);
