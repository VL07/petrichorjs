export function throwUnparseableError(name: string): never {
    throw new UnparseableError(name);
}

export class UnparseableError extends Error {
    constructor(readonly name: string) {
        super(`Unparseable route param or query param: '${name}'!`);
    }
}
