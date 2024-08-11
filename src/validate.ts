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

export type ValidatorFunction<T> = (data: unknown) => ValidatorResponse<T>;

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
    [K in ValidatorType]: ValidatorFunction<unknown>;
}>;

export type ValidatedFunctions<T extends ValidatorFunctions> = {
    [K in keyof T]: T[K] extends ValidatorFunction<unknown>
        ? Validated<T[K]>
        : never;
};

