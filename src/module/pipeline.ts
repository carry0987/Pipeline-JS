import { PipelineProcessor } from './processor';
import { ProcessorType } from '../type/types';
import { ID } from './utils/id';
import log from './utils/log';
import { EventEmitter } from '@carry0987/event-emitter';
import { PipelineEvents } from '../interface/events';

class Pipeline<R> extends EventEmitter<PipelineEvents<R>> {
    // available steps for this pipeline
    private readonly _steps: Map<
        ProcessorType,
        PipelineProcessor<unknown, unknown>[]
    > = new Map<ProcessorType, PipelineProcessor<unknown, unknown>[]>();
    // used to cache the results of processors using their id field
    private cache: Map<string, unknown> = new Map<string, unknown>();
    // keeps the index of the last updated processor in the registered
    // processors list and will be used to invalidate the cache
    // -1 means all new processors should be processed
    private lastProcessorIndexUpdated = -1;

    constructor(steps?: PipelineProcessor<unknown, unknown>[]) {
        super();

        if (steps) {
            steps.forEach((step) => this.register(step));
        }
    }

    /**
     * Clears the `cache` array
     */
    clearCache(): void {
        this.cache = new Map<string, object>();
        this.lastProcessorIndexUpdated = -1;
    }

    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    register<T, P>(
        processor: PipelineProcessor<T, P>,
        priority: number = null
    ): PipelineProcessor<T, P> {
        if (!processor) {
            throw Error('Processor is not defined');
        }

        if (processor.type === null) {
            throw Error('Processor type is not defined');
        }

        if (this.findProcessorIndexByID(processor.id) > -1) {
            throw Error(`Processor ID ${processor.id} is already defined`);
        }

        // binding the propsUpdated callback to the Pipeline
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
    tryRegister<T, P>(
        processor: PipelineProcessor<T, P>,
        priority: number = null
    ): PipelineProcessor<T, P> | undefined {
        try {
            return this.register(processor, priority);
        } catch (_) {
            // noop
        }

        return undefined;
    }

    /**
     * Removes a processor from the list
     *
     * @param processor
     */
    unregister<T, P>(processor: PipelineProcessor<T, P>): void {
        if (!processor) return;
        if (this.findProcessorIndexByID(processor.id) === -1) return;

        const subSteps = this._steps.get(processor.type);

        if (subSteps && subSteps.length) {
            this._steps.set(
                processor.type,
                subSteps.filter((proc) => proc != processor)
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
    private addProcessorByPriority<T, P>(
        processor: PipelineProcessor<T, P>,
        priority: number
    ): void {
        let subSteps = this._steps.get(processor.type);

        if (!subSteps) {
            const newSubStep = [];
            this._steps.set(processor.type, newSubStep);
            subSteps = newSubStep;
        }

        if (priority === null || priority < 0) {
            subSteps.push(processor);
        } else {
            if (!subSteps[priority]) {
                // slot is empty
                subSteps[priority] = processor;
            } else {
                // slot is NOT empty
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
    get steps(): PipelineProcessor<unknown, unknown>[] {
        let steps: PipelineProcessor<unknown, unknown>[] = [];

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
    getStepsByType(type: ProcessorType): PipelineProcessor<unknown, unknown>[] {
        return this.steps.filter((process) => process.type === type);
    }

    /**
     * Returns a list of ProcessorType according to their priority
     */
    private getSortedProcessorTypes(): ProcessorType[] {
        return Object.keys(ProcessorType)
            .filter((key) => !isNaN(Number(key)))
            .map((key) => Number(key));
    }

    /**
     * Runs all registered processors based on their correct priority
     * and returns the final output after running all steps
     *
     * @param data
     */
    async process(data?: R): Promise<R> {
        const lastProcessorIndexUpdated = this.lastProcessorIndexUpdated;
        const steps = this.steps;

        let prev = data;

        try {
            for (const processor of steps) {
                const processorIndex = this.findProcessorIndexByID(
                    processor.id
                );

                if (processorIndex >= lastProcessorIndexUpdated) {
                    // we should execute process() here since the last
                    // updated processor was before "processor".
                    // This is to ensure that we always have correct and up to date
                    // data from processors and also to skip them when necessary
                    prev = (await processor.process(prev)) as R;
                    this.cache.set(processor.id, prev);
                } else {
                    // cached results already exist
                    prev = this.cache.get(processor.id) as R;
                }
            }
        } catch (e) {
            log.error(e);
            // trigger the onError callback
            this.emit('error', prev);

            // rethrow
            throw e;
        }

        // means the pipeline is up to date
        this.lastProcessorIndexUpdated = steps.length;

        // triggers the afterProcess callbacks with the results
        this.emit('afterProcess', prev);

        return prev;
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
    private setLastProcessorIndex<T, P>(
        processor: PipelineProcessor<T, P>
    ): void {
        const processorIndex = this.findProcessorIndexByID(processor.id);

        if (this.lastProcessorIndexUpdated > processorIndex) {
            this.lastProcessorIndexUpdated = processorIndex;
        }
    }

    private processorPropsUpdated(processor): void {
        this.setLastProcessorIndex(processor);
        this.emit('propsUpdated');
        this.emit('updated', processor);
    }

    private afterRegistered(processor): void {
        this.setLastProcessorIndex(processor);
        this.emit('afterRegister');
        this.emit('updated', processor);
    }
}

export { Pipeline };
