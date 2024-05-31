import { EventEmitter } from '@carry0987/event-emitter';

type ID = string;

interface ProcessorProps {
}
interface ProcessorEvents {
    propsUpdated: <T, P extends Partial<ProcessorProps>, PT>(processor: Processor<T, P, PT>) => void;
    beforeProcess: (...args: any[]) => void;
    afterProcess: (...args: any[]) => void;
}

declare abstract class Processor<T, P extends Partial<ProcessorProps>, PT> extends EventEmitter<ProcessorEvents> {
    readonly id: ID;
    private _props;
    abstract get type(): PT;
    protected abstract _process(...args: any[]): T | Promise<T>;
    protected validateProps?(...args: any[]): void;
    constructor(props?: Partial<P>);
    /**
     * process is used to call beforeProcess and afterProcess callbacks
     * This function is just a wrapper that calls _process()
     *
     * @param args
     */
    process(...args: any[]): T | Promise<T>;
    setProps(props: Partial<P>): this;
    get props(): P;
}

interface PipelineEvents<R> {
    /**
     * Generic updated event. Triggers the callback function when the pipeline
     * is updated, including when a new processor is registered, a processor's props
     * get updated, etc.
     */
    updated: <T, P extends ProcessorProps, PT>(processor: Processor<T, P, PT>) => void;
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
    afterProcess: (prev: R) => void;
    /**
     * Triggers the callback function when the pipeline
     * fails to process all steps or at least one step
     * throws an Error
     */
    error: <T>(prev: T) => void;
}

declare class Pipeline<R, T extends string | number, PT extends T> extends EventEmitter<PipelineEvents<R>> {
    private readonly _steps;
    private cache;
    private lastProcessorIndexUpdated;
    constructor(steps?: Processor<unknown, Partial<ProcessorProps>, PT>[]);
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
    register<U, P extends Partial<ProcessorProps>>(processor: Processor<U, P, PT>, priority?: number): Processor<U, P, PT>;
    /**
     * Tries to register a new processor
     * @param processor
     * @param priority
     */
    tryRegister<U, P extends Partial<ProcessorProps>>(processor: Processor<U, P, PT>, priority: number): Processor<U, P, PT> | undefined;
    /**
     * Removes a processor from the list
     *
     * @param processor
     */
    unregister<U, P extends Partial<ProcessorProps>, X extends T>(processor: Processor<U, P, X>): void;
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
    get steps(): Processor<unknown, Partial<ProcessorProps>, PT>[];
    /**
     * Accepts ProcessType and returns an array of the registered processes
     * with the give type
     *
     * @param type
     */
    getStepsByType(type: T): Processor<unknown, Partial<ProcessorProps>, PT>[];
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
    process(data?: R): Promise<R>;
    /**
     * Returns the registered processor's index in _steps array
     *
     * @param processorID
     */
    private findProcessorIndexByID;
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

export { Pipeline, type PipelineEvents, Processor, type ProcessorEvents, type ProcessorProps, version };
