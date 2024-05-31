import { PipelineProcessorProps } from './interfaces';
import { PipelineProcessor } from '../module/processor';

export interface PipelineEvents<R> {
    /**
     * Generic updated event. Triggers the callback function when the pipeline
     * is updated, including when a new processor is registered, a processor's props
     * get updated, etc.
     */
    updated: <T, P extends PipelineProcessorProps, PT>(processor: PipelineProcessor<T, P, PT>) => void;
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
