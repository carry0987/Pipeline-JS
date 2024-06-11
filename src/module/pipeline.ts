import { Processor } from './processor';
import log from './utils/log';
import { PipelineEvents } from '@/interface/events';
import { ProcessorProps } from '@/interface/interfaces';
import { ProcessorType, ID } from '@/type/types';
import { EventEmitter } from '@carry0987/event-emitter';

class Pipeline<R, T extends ProcessorType, PT extends T = T> extends EventEmitter<PipelineEvents<R>> {
    // Available steps for this pipeline
    private readonly _steps: Map<T, Processor<R, PT, Partial<ProcessorProps>>[]> = new Map<T, Processor<R, PT, Partial<ProcessorProps>>[]>();
    // Used to cache the results of processors using their id field
    private cache: Map<string, R> = new Map<string, R>();
    // Keeps the index of the last updated processor in the registered
    // processors list and will be used to invalidate the cache
    // -1 means all new processors should be processed
    private lastProcessorIndexUpdated = -1;

    constructor(steps?: Processor<R, PT, Partial<ProcessorProps>>[]) {
        super();

        if (steps) {
            steps.forEach((step) => this.register(step));
        }
    }

    /**
     * Clears the `cache` array
     */
    public clearCache(): void {
        this.cache = new Map<string, R>();
        this.lastProcessorIndexUpdated = -1;
    }

    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    public register<P extends Partial<ProcessorProps>>(
        processor: Processor<R, PT, P>,
        priority: number = -1
    ): Processor<R, PT, P> {
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
        processor.on('propsUpdated', this.processorPropsUpdated.bind(this, processor));
        this.addProcessorByPriority(processor, priority);
        this.afterRegistered(processor);

        return processor;
    }

    /**
     * Tries to register a new processor
     * @param processor
     * @param priority
     */
    public tryRegister<P extends Partial<ProcessorProps>>(
        processor: Processor<R, PT, P>,
        priority: number
    ): Processor<R, PT, P> | undefined {
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
    public unregister<P extends Partial<ProcessorProps>>(processor?: Processor<R, PT, P>): void {
        if (!processor) return;
        if (this.findProcessorIndexByID(processor.id) === -1) return;

        const subSteps = this._steps.get(processor.type);

        if (subSteps && subSteps.length) {
            this._steps.set(
                processor.type,
                subSteps.filter((proc) => proc.id !== processor.id)
            );
            // Remove the event listener
            processor.off('propsUpdated', this.processorPropsUpdated.bind(this, processor));
            this.emit('updated', processor);
        }
    }

    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    private addProcessorByPriority<P extends Partial<ProcessorProps>>(
        processor: Processor<R, PT, P>,
        priority: number = -1
    ): void {
        let subSteps = this._steps.get(processor.type);

        if (!subSteps) {
            const newSubStep: Processor<R, PT, Partial<ProcessorProps>>[] = [];
            this._steps.set(processor.type, newSubStep);
            subSteps = newSubStep;
        }

        if (priority < 0 || priority >= subSteps.length) {
            subSteps.push(processor);
        } else {
            subSteps.splice(priority, 0, processor);
        }
    }

    /**
     * Flattens the _steps Map and returns a list of steps with their correct priorities
     */
    public get steps(): Processor<R, PT, Partial<ProcessorProps>>[] {
        let steps: Processor<R, PT, Partial<ProcessorProps>>[] = [];

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
    public getStepsByType(type: T): Processor<R, PT, Partial<ProcessorProps>>[] {
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
    public async process(): Promise<undefined>;
    public async process(data: R): Promise<R>;
    public async process(data?: R): Promise<R | undefined> {
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
                    prev = await processor.process(prev);
                    this.cache.set(processor.id, prev);
                } else {
                    // Cached results already exist
                    prev = this.cache.get(processor.id);
                    if (prev === undefined) {
                        prev = await processor.process(prev);
                    }
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
        this.emit('afterProcess', prev);

        return prev;
    }

    /**
     * Runs all registered processors in parallel and returns the final results after running all steps.
     * @param data
     */
    public async processInParallel(): Promise<Array<undefined>>;
    public async processInParallel(data: R): Promise<Array<R>>;
    public async processInParallel(data?: R): Promise<Array<R | undefined>> {
        const steps = this.steps;
        // No need for processor index check because all processors run in parallel
        const results = await Promise.all(steps.map(processor => processor.process(data)));
        results.forEach((result, index) => this.cache.set(steps[index].id, result));
        this.lastProcessorIndexUpdated = steps.length;
        this.emit('afterProcess', results);

        return results;
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
    public getProcessorByID(processorID: ID): Processor<R, PT, Partial<ProcessorProps>> | null {
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
    public async runProcessorByID(processorID: ID): Promise<undefined>;
    public async runProcessorByID(processorID: ID, data: R): Promise<R>;
    public async runProcessorByID(processorID: ID, data: R, runAllFollowing: boolean): Promise<R>;
    public async runProcessorByID(processorID: ID, runAllFollowing: boolean): Promise<undefined>;
    public async runProcessorByID(processorID: ID, dataOrRunAllFollowing?: R | boolean, runAllFollowing: boolean = true): Promise<R | undefined> {
        const processorIndex = this.findProcessorIndexByID(processorID);

        if (processorIndex === -1) {
            throw Error(`Processor ID ${processorID} not found`);
        }

        // Determine the actual type of dataOrRunAllFollowing
        let data: R | undefined;
        if (typeof dataOrRunAllFollowing === 'boolean') {
            runAllFollowing = dataOrRunAllFollowing;
        } else {
            data = dataOrRunAllFollowing;
        }

        if (runAllFollowing) {
            this.lastProcessorIndexUpdated = processorIndex;
            // Clear cache for all processors after the rerun processor
            this.clearCacheAfterProcessorIndex(processorIndex);
        } else {
            // If not re-running all, just clear the cache for the specific processor
            this.cache.delete(processorID);
        }

        return data ? this.process(data) : this.process();
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
    private setLastProcessorIndex<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>): void {
        const processorIndex = this.findProcessorIndexByID(processor.id);

        if (this.lastProcessorIndexUpdated > processorIndex) {
            this.lastProcessorIndexUpdated = processorIndex;
        }
    }

    private processorPropsUpdated<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>): void {
        this.setLastProcessorIndex(processor);
        this.emit('propsUpdated');
        this.emit('updated', processor);
    }

    private afterRegistered<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>): void {
        this.setLastProcessorIndex(processor);
        this.emit('afterRegister');
        this.emit('updated', processor);
    }
}

export { Pipeline };
