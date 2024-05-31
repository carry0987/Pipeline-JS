import { Processor } from './processor';
import { ID } from './utils/id';
import log from './utils/log';
import { EventEmitter } from '@carry0987/event-emitter';
import { PipelineEvents } from '../interface/events';
import { ProcessorProps } from '../interface/interfaces';

class Pipeline<R, T extends string | number, PT extends T> extends EventEmitter<PipelineEvents<R>> {
    // available steps for this pipeline
    private readonly _steps: Map<T, Processor<unknown, Partial<ProcessorProps>, PT>[]> = new Map<T, Processor<unknown, Partial<ProcessorProps>, PT>[]>();
    // used to cache the results of processors using their id field
    private cache: Map<string, unknown> = new Map<string, unknown>();
    // keeps the index of the last updated processor in the registered
    // processors list and will be used to invalidate the cache
    // -1 means all new processors should be processed
    private lastProcessorIndexUpdated = -1;

    constructor(steps?: Processor<unknown, Partial<ProcessorProps>, PT>[]) {
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
    public register<U, P extends Partial<ProcessorProps>>(
        processor: Processor<U, P, PT>,
        priority: number = -1
    ): Processor<U, P, PT> {
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
    public tryRegister<U, P extends Partial<ProcessorProps>>(
        processor: Processor<U, P, PT>,
        priority: number
    ): Processor<U, P, PT> | undefined {
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
    public unregister<U, P extends Partial<ProcessorProps>, X extends T>(processor: Processor<U, P, X>): void {
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
    private addProcessorByPriority<U, P extends Partial<ProcessorProps>>(
        processor: Processor<U, P, PT>,
        priority: number = -1
    ): void {
        let subSteps = this._steps.get(processor.type);

        if (!subSteps) {
            const newSubStep: Processor<unknown, Partial<ProcessorProps>, PT>[] = [];
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
    public get steps(): Processor<unknown, Partial<ProcessorProps>, PT>[] {
        let steps: Processor<unknown, Partial<ProcessorProps>, PT>[] = [];

        for (const type of this.getSortedProcessorTypes()) {
            const subSteps = this._steps.get(type);

            if (subSteps && subSteps.length) {
                steps = steps.concat(subSteps);
            }
        }

        // To remove any undefined elements
        return steps.filter((s) => s);
    }

    /**
     * Accepts ProcessType and returns an array of the registered processes
     * with the give type
     *
     * @param type
     */
    public getStepsByType(type: T): Processor<unknown, Partial<ProcessorProps>, PT>[] {
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
     * Removes all processors from the pipeline
     */
    public clearProcessors(): void {
        this._steps.clear();
        this.clearCache();
    }

    /**
     * Returns processor by ID
     *
     * @param id
     */
    public getProcessorByID(processorID: ID): Processor<unknown, Partial<ProcessorProps>, PT> | null {
        const index = this.findProcessorIndexByID(processorID);

        return index > -1 ? this.steps[index] : null;
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
     * Runs a processor by its ID
     *
     * @param processorID
     * @param data
     * @param rerunAllFollowing (optional) if true, rerun all processors following the specified processor
     */
    public async runProcessorByID(processorID: ID, data?: R, rerunAllFollowing: boolean = true): Promise<R | undefined> {
        const processorIndex = this.findProcessorIndexByID(processorID);

        if (processorIndex === -1) {
            throw Error(`Processor ID ${processorID} not found`);
        }

        if (rerunAllFollowing) {
            this.lastProcessorIndexUpdated = processorIndex;
            // Clear cache for all processors after the rerun processor
            this.clearCacheAfterProcessorIndex(processorIndex);
        } else {
            // If not rerunning all, just clear the cache for the specific processor
            this.cache.delete(processorID);
        }

        return this.process(data);
    }

    /**
     * Clears the cache for all processors after the specified index
     *
     * @param index
     */
    private clearCacheAfterProcessorIndex(index: number): void {
        this.steps.slice(index).forEach(processor => {
            this.cache.delete(processor.id);
        });
    }

    /**
     * Sets the last updates processors index locally
     * This is used to invalid or skip a processor in
     * the process() method
     */
    private setLastProcessorIndex<U, P extends Partial<ProcessorProps>, X>(processor: Processor<U, P, X>): void {
        const processorIndex = this.findProcessorIndexByID(processor.id);

        if (this.lastProcessorIndexUpdated > processorIndex) {
            this.lastProcessorIndexUpdated = processorIndex;
        }
    }

    private processorPropsUpdated<U, P extends Partial<ProcessorProps>, X>(processor: Processor<U, P, X>): void {
        this.setLastProcessorIndex(processor);
        this.emit('propsUpdated');
        this.emit('updated', processor);
    }

    private afterRegistered<U, P extends Partial<ProcessorProps>, X>(processor: Processor<U, P, X>): void {
        this.setLastProcessorIndex(processor);
        this.emit('afterRegister');
        this.emit('updated', processor);
    }
}

export { Pipeline };
