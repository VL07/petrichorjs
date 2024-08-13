# PetrichorJs

The simple type safe web server framework written in TypeScript. 

## Installation

> [!CAUTION]
> Petrichor is still in early development and **will** contain bugs!

Petrichor can be installed with npm. 

```
npm i petrichor
```

## Documentation

> [!NOTE]
> This project currently has no documentation exept for whats written as comments for the different types in the project. 
> 
> In the meantime here's an example. 

```ts
import {
  HttpError,
  intParser,
  Router,
  statusCodes,
  trailingSlash,
} from "petrichorjs";

const getUserBeforeFunction = beforeFunction<{ id: number }, { user: User }>(
  (request) => {
    const user = getUser(request.params.id);
    if (!user) throw new HttpError(statusCodes.NotFound, "Not found!");

    return {
      user: user,
    };
  }
);

const router = new Router();

router.use(trailingSlash());

router.get("/").handle(({ response }) => {
  response.ok().json({
    message: "Hello World!",
  });
});

const usersGroup = router.group("/users").handle();

usersGroup.post("/").handle(async ({ request, response }) => {
  const body = await request.json();
  users.push(body as User);

  response.created().json({
    message: "Successfully created user!",
  });
});

const userGroup = usersGroup
  .group("/:id")
  .parse({
    id: intParser,
  })
  .before(getUserBeforeFunction)
  .handle();

userGroup.get("/").handle(({ request, response }) => {
  response.ok().json(request.locals.user);
});

router.listen(3332);
```