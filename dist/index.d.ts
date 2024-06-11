import { EventEmitter } from '@carry0987/event-emitter';

interface ProcessorProps {
}

type ProcessorType = string | number;
type ID = string;

interface PipelineEvents<R> {
    /**
     * Generic updated event. Triggers the callback function when the pipeline
     * is updated, including when a new processor is registered, a processor's props
     * get updated, etc.
     */
    updated: <T, PT extends ProcessorType, P extends ProcessorProps>(processor: Processor<T, PT, P>) => void;
    /**
     * Triggers the callback function when a new
     * processor is registered successfully
     */
    afterRegister: () => void;
    /**
     * Triggers the callback when a registered
     * processor's property is updated
     */
    propsUpdated: () => void;
    /**
     * Triggers the callback function when the pipeline
     * is fully processed, before returning the results
     *
     * afterProcess will not be called if there is an
     * error in the pipeline (i.e a step throw an Error)
     */
    afterProcess: (prev: R | Array<R | undefined> | undefined) => void;
    /**
     * Triggers the callback function when the pipeline
     * fails to process all steps or at least one step
     * throws an Error
     */
    error: <T>(prev: T) => void;
}
interface ProcessorEvents {
    /**
     * Event triggered when a processor's properties are updated.
     *
     * @param processor - The processor instance that had its properties updated.
     */
    propsUpdated: <T, PT extends ProcessorType, P extends Partial<ProcessorProps>>(processor: Processor<T, PT, P>) => void;
    /**
     * Event triggered before a processor starts processing.
     * This allows for any pre-processing steps or logging to occur.
     *
     * @param args - Arguments passed to the process method.
     */
    beforeProcess: (...args: any[]) => void;
    /**
     * Event triggered after a processor finishes processing.
     * This allows for any post-processing steps or logging to occur.
     *
     * @param args - Arguments passed to the process method.
     */
    afterProcess: (...args: any[]) => void;
    /**
     * Event triggered when a processing error occurs.
     * This allows for error handling or logging to take place.
     *
     * @param error - The error that occurred during processing.
     * @param args - Arguments passed to the process method.
     */
    error: (error: Error, ...args: any[]) => void;
}

declare abstract class Processor<T, PT extends ProcessorType, P extends Partial<ProcessorProps> = {}> extends EventEmitter<ProcessorEvents> {
    readonly id: ID;
    readonly name?: string;
    private static readonly _statusTypes;
    private _props;
    private _status;
    abstract get type(): PT;
    protected abstract _process(...args: any[]): Promise<T>;
    protected validateProps?(...args: any[]): void;
    constructor(props?: Partial<P>, name?: string);
    /**
     * process is used to call beforeProcess and afterProcess callbacks
     * This function is just a wrapper that calls _process()
     *
     * @param args
     */
    process(...args: any[]): Promise<T>;
    setProps(props: Partial<P>): this;
    get props(): P;
    get status(): typeof Processor._statusTypes[number];
}

declare class Pipeline<R, T extends ProcessorType, PT extends T = T> extends EventEmitter<PipelineEvents<R>> {
    private readonly _steps;
    private cache;
    private lastProcessorIndexUpdated;
    constructor(steps?: Processor<R, PT, Partial<ProcessorProps>>[]);
    /**
     * Clears the `cache` array
     */
    clearCache(): void;
    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    register<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>, priority?: number): Processor<R, PT, P>;
    /**
     * Tries to register a new processor
     * @param processor
     * @param priority
     */
    tryRegister<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>, priority: number): Processor<R, PT, P> | undefined;
    /**
     * Removes a processor from the list
     *
     * @param processor
     */
    unregister<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>): void;
    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    private addProcessorByPriority;
    /**
     * Flattens the _steps Map and returns a list of steps with their correct priorities
     */
    get steps(): Processor<R, PT, Partial<ProcessorProps>>[];
    /**
     * Accepts ProcessType and returns an array of the registered processes
     * with the give type
     *
     * @param type
     */
    getStepsByType(type: T): Processor<R, PT, Partial<ProcessorProps>>[];
    /**
     * Returns a list of ProcessorType according to their priority
     */
    private getSortedProcessorTypes;
    /**
     * Runs all registered processors based on their correct priority
     * and returns the final output after running all steps
     *
     * @param data
     */
    process(): Promise<undefined>;
    process(data: R): Promise<R>;
    /**
     * Runs all registered processors in parallel and returns the final results after running all steps.
     * @param data
     */
    processInParallel(): Promise<Array<undefined>>;
    processInParallel(data: R): Promise<Array<R>>;
    /**
     * Removes all processors from the pipeline
     */
    clearProcessors(): void;
    /**
     * Returns processor by ID
     *
     * @param id
     */
    getProcessorByID(processorID: ID): Processor<R, PT, Partial<ProcessorProps>> | null;
    /**
     * Returns the registered processor's index in _steps array
     *
     * @param processorID
     */
    private findProcessorIndexByID;
    /**
     * Runs a processor by its ID
     *
     * @param processorID
     * @param data
     * @param rerunAllFollowing (optional) if true, rerun all processors following the specified processor
     */
    runProcessorByID(processorID: ID): Promise<undefined>;
    runProcessorByID(processorID: ID, data: R): Promise<R>;
    runProcessorByID(processorID: ID, data: R, runAllFollowing: boolean): Promise<R>;
    runProcessorByID(processorID: ID, runAllFollowing: boolean): Promise<undefined>;
    /**
     * Clears the cache for all processors after the specified index
     *
     * @param index
     */
    private clearCacheAfterProcessorIndex;
    /**
     * Sets the last updates processors index locally
     * This is used to invalid or skip a processor in
     * the process() method
     */
    private setLastProcessorIndex;
    private processorPropsUpdated;
    private afterRegistered;
}

declare const version: string;

export { type ID, Pipeline, Processor, type ProcessorProps, version };
