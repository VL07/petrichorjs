import { Method } from "../router/router.js";
import { Path } from "../types/path.js";
import { ResponseStream, StreamFunction } from "./responseStream.js";
import http from "node:http";

export class NodeResponseStream<
    R extends Path | null,
    M extends Method[] | unknown,
> extends ResponseStream<R, M> {
    protected override streamFunction: StreamFunction<ResponseStream<R, M>>;

    constructor(
        private readonly response: http.ServerResponse,
        streamFunction: StreamFunction<ResponseStream<R, M>>
    ) {
        super();

        this.streamFunction = streamFunction;
    }

    override async write(chunk: string): Promise<void> {
        for (const dataListener of this.onDataListeners) {
            await dataListener(chunk);
        }

        return new Promise((resolve, reject) => {
            this.response.write(chunk, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    }

    override async close(): Promise<void> {
        for (const closeListener of this.onCloseListeners) {
            await closeListener();
        }

        return new Promise((resolve) => {
            this.response.end(() => {
                resolve();
            });
        });
    }
}

