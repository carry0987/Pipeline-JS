import { ProcessorProps } from './interfaces';
import { Processor } from '@/module/processor';
import { ProcessorType } from '@/type/types';

export interface PipelineEvents<R> {
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

export interface ProcessorEvents {
    /**
     * Event triggered when a processor's properties are updated.
     *
     * @param processor - The processor instance that had its properties updated.
     */
    propsUpdated: <T, PT extends ProcessorType, P extends Partial<ProcessorProps>>(
        processor: Processor<T, PT, P>
    ) => void;

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
