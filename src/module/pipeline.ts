import { PipelineProcessor } from './processor';
import { ID } from './utils/id';
import log from './utils/log';
import { EventEmitter } from '@carry0987/event-emitter';
import { PipelineEvents } from '../interface/events';
import { PipelineProcessorProps } from '../interface/interfaces';

class Pipeline<R, T extends string | number, PT extends T> extends EventEmitter<PipelineEvents<R>> {
    // available steps for this pipeline
    private readonly _steps: Map<T, PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[]> = new Map<T, PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[]>();
    // used to cache the results of processors using their id field
    private cache: Map<string, unknown> = new Map<string, unknown>();
    // keeps the index of the last updated processor in the registered
    // processors list and will be used to invalidate the cache
    // -1 means all new processors should be processed
    private lastProcessorIndexUpdated = -1;

    constructor(steps?: PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[]) {
        super();

        if (steps) {
            steps.forEach((step) => this.register(step));
        }
    }

    /**
     * Clears the `cache` array
     */
    public clearCache(): void {
        this.cache = new Map<string, object>();
        this.lastProcessorIndexUpdated = -1;
    }

    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    public register<U, P extends Partial<PipelineProcessorProps>>(
        processor: PipelineProcessor<U, P, PT>,
        priority: number = -1
    ): PipelineProcessor<U, P, PT> {
        if (!processor) {
            throw Error('Processor is not defined');
        }

        if (processor.type === null) {
            throw Error('Processor type is not defined');
        }

        if (this.findProcessorIndexByID(processor.id) > -1) {
            throw Error(`Processor ID ${processor.id} is already defined`);
        }

        // Binding the propsUpdated callback to the Pipeline
        processor.on('propsUpdated', this.processorPropsUpdated.bind(this));
        this.addProcessorByPriority(processor, priority);
        this.afterRegistered(processor);

        return processor;
    }

    /**
     * Tries to register a new processor
     * @param processor
     * @param priority
     */
    public tryRegister<U, P extends Partial<PipelineProcessorProps>>(
        processor: PipelineProcessor<U, P, PT>,
        priority: number
    ): PipelineProcessor<U, P, PT> | undefined {
        try {
            return this.register(processor, priority);
        } catch (_) {
            return undefined;
        }
    }

    /**
     * Removes a processor from the list
     *
     * @param processor
     */
    public unregister<U, P extends Partial<PipelineProcessorProps>, X extends T>(processor: PipelineProcessor<U, P, X>): void {
        if (!processor) return;
        if (this.findProcessorIndexByID(processor.id) === -1) return;

        const subSteps = this._steps.get(processor.type);

        if (subSteps && subSteps.length) {
            this._steps.set(
                processor.type,
                subSteps.filter((proc) => proc.id !== processor.id)
            );
            this.emit('updated', processor);
        }
    }

    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    private addProcessorByPriority<U, P extends Partial<PipelineProcessorProps>, X extends T>(
        processor: PipelineProcessor<U, P, PT>,
        priority: number = -1
    ): void {
        let subSteps = this._steps.get(processor.type);

        if (!subSteps) {
            const newSubStep: PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[] = [];
            this._steps.set(processor.type, newSubStep);
            subSteps = newSubStep;
        }

        if (priority === null || priority < 0) {
            subSteps.push(processor);
        } else {
            if (!subSteps[priority]) {
                // Slot is empty
                subSteps[priority] = processor;
            } else {
                // Slot is NOT empty
                const first = subSteps.slice(0, priority - 1);
                const second = subSteps.slice(priority + 1);

                this._steps.set(
                    processor.type,
                    first.concat(processor).concat(second)
                );
            }
        }
    }

    /**
     * Flattens the _steps Map and returns a list of steps with their correct priorities
     */
    public get steps(): PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[] {
        let steps: PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[] = [];

        for (const type of this.getSortedProcessorTypes()) {
            const subSteps = this._steps.get(type);

            if (subSteps && subSteps.length) {
                steps = steps.concat(subSteps);
            }
        }

        // to remove any undefined elements
        return steps.filter((s) => s);
    }

    /**
     * Accepts ProcessType and returns an array of the registered processes
     * with the give type
     *
     * @param type
     */
    public getStepsByType(type: T): PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[] {
        return this.steps.filter((process) => process.type === type);
    }

    /**
     * Returns a list of ProcessorType according to their priority
     */
    private getSortedProcessorTypes(): T[] {
        return Array.from(this._steps.keys());
    }

    /**
     * Runs all registered processors based on their correct priority
     * and returns the final output after running all steps
     *
     * @param data
     */
    public async process(data?: R): Promise<R> {
        const lastProcessorIndexUpdated = this.lastProcessorIndexUpdated;
        const steps = this.steps;

        let prev = data;

        try {
            for (const processor of steps) {
                const processorIndex = this.findProcessorIndexByID(processor.id);

                if (processorIndex >= lastProcessorIndexUpdated) {
                    // We should execute process() here since the last
                    // updated processor was before "processor".
                    // This is to ensure that we always have correct and up to date
                    // data from processors and also to skip them when necessary
                    prev = (await processor.process(prev)) as R;
                    this.cache.set(processor.id, prev);
                } else {
                    // Cached results already exist
                    prev = this.cache.get(processor.id) as R;
                }
            }
        } catch (e) {
            log.error(e);
            // Trigger the onError callback
            this.emit('error', prev);
            throw e;
        }

        // Means the pipeline is up to date
        this.lastProcessorIndexUpdated = steps.length;

        // Triggers the afterProcess callbacks with the results
        this.emit('afterProcess', prev as R);

        return prev as R;
    }

    /**
     * Returns the registered processor's index in _steps array
     *
     * @param processorID
     */
    private findProcessorIndexByID(processorID: ID): number {
        return this.steps.findIndex((p) => p.id == processorID);
    }

    /**
     * Sets the last updates processors index locally
     * This is used to invalid or skip a processor in
     * the process() method
     */
    private setLastProcessorIndex<U, P extends Partial<PipelineProcessorProps>, X>(processor: PipelineProcessor<U, P, X>): void {
        const processorIndex = this.findProcessorIndexByID(processor.id);

        if (this.lastProcessorIndexUpdated > processorIndex) {
            this.lastProcessorIndexUpdated = processorIndex;
        }
    }

    private processorPropsUpdated<U, P extends Partial<PipelineProcessorProps>, X>(processor: PipelineProcessor<U, P, X>): void {
        this.setLastProcessorIndex(processor);
        this.emit('propsUpdated');
        this.emit('updated', processor);
    }

    private afterRegistered<U, P extends Partial<PipelineProcessorProps>, X>(processor: PipelineProcessor<U, P, X>): void {
        this.setLastProcessorIndex(processor);
        this.emit('afterRegister');
        this.emit('updated', processor);
    }
}

export { Pipeline };
