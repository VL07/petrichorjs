export type ValidatorError = {
    message: string;
};

export type ValidatorResponseSuccess<T> = {
    success: true;
    data: T;
};

export type ValidatorResponseFail = {
    success: false;
    errors: ValidatorError[];
};

export type ValidatorResponse<T> =
    | ValidatorResponseSuccess<T>
    | ValidatorResponseFail;

export type ValidatorFunction<T, U = unknown> = (
    data: U
) => ValidatorResponse<T> | Promise<ValidatorResponse<T>>;

export type ValidatorType = "body" | "query";

export type Validated<T extends ValidatorFunction<unknown>> = Extract<
    ReturnType<T>,
    { success: true }
>["data"];

export type Validators = Partial<{
    [K in ValidatorType]: Validated<ValidatorFunction<unknown>>;
}>;

/** Join {@link Validators} where `T` are the new ones and `U` the old */
export type JoinValidators<T extends Validators, U extends Validators> = T &
    Omit<U, keyof T>;

export type ValidatorFunctions = Partial<{
    body: ValidatorFunction<unknown>;
    query: ValidatorFunction<Record<string, unknown>, Record<string, unknown>>;
}>;

export type ValidatedFunctions<T extends ValidatorFunctions> = {
    [K in keyof T]: T[K] extends ValidatorFunction<any, any>
        ? Validated<T[K]>
        : never;
};

export type UnvalidatedFunctions<T extends Validators> = keyof Omit<
    ValidatorFunctions,
    keyof T
> extends never
    ? never
    : Omit<ValidatorFunctions, keyof T>;

