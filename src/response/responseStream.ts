import { Method } from "../router.js";
import { Path } from "../types/path.js";

type StreamDataEventListener = (chunk: string) => Promise<void> | void;
type StreamCloseEventListener = () => Promise<void> | void;
export type StreamFunction<T extends ResponseStream<null, unknown>> = (
    stream: T
) => Promise<void> | void;

export abstract class ResponseStream<
    R extends Path | null,
    M extends Method[] | unknown,
> {
    protected abstract streamFunction: StreamFunction<ResponseStream<R, M>>;
    protected onDataListeners: StreamDataEventListener[] = [];
    protected onCloseListeners: StreamCloseEventListener[] = [];

    /**
     * Writes a chunk to the response, returns a promise that resolves when the
     * client has handled the chunk
     *
     * @example
     *     stream.write("Hello World!"); // Send chunk
     *     stream.close(); // End connection
     */
    abstract write(chunk: string): Promise<void>;

    /**
     * Closes the stream, after this nothing more can be written to it. Before
     * it gets closed all middleware {@link onClose} events will be called
     */
    abstract close(): Promise<void>;

    /**
     * Creates an event listener that fires when data is sent through the
     * stream, before the data gets sent to the client.
     */
    onData(listener: StreamDataEventListener): void {
        this.onDataListeners.push(listener);
    }

    /**
     * Creates an event listener that fires when the stream is closed, before
     * the stream closes for the client.
     */
    onClose(listener: StreamCloseEventListener): void {
        this.onCloseListeners.push(listener);
    }

    /** **ONLY FOR INTERNAL USE** @internal */
    async _start(): Promise<void> {
        await this.streamFunction(this);
    }

    /** A promise that resolves after the delay */
    sleep(delayMs: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, delayMs);
        });
    }
}

