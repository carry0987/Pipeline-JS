import { test, expect, vi } from 'vitest';
import { Pipeline, Processor } from '../src/index';
import { ProcessorType } from './type/types';
import log from '../src/module/utils/log';

class MockProcessor extends Processor<string, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Extractor;
    }

    protected async _process(): Promise<string> {
        return 'processed';
    }
}

class FailingProcessor extends Processor<string, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Transformer;
    }

    protected async _process(): Promise<string> {
        throw new Error('Processing failed');
    }
}

test('Pipeline processes data correctly', async () => {
    const pipeline = new Pipeline<string, ProcessorType>();
    const processor = new MockProcessor();

    pipeline.register(processor);
    const result = await pipeline.process('input');

    expect(result).toBe('processed');
});

test('Pipeline processes data in parallel correctly', async () => {
    class ParallelProcessor extends Processor<string, ProcessorType> {
        get type(): ProcessorType {
            return ProcessorType.Extractor;
        }

        protected async _process(): Promise<string> {
            return 'parallel_processed';
        }
    }

    const pipeline = new Pipeline<string, ProcessorType>();
    const processor1 = new MockProcessor();
    const processor2 = new ParallelProcessor();

    pipeline.register(processor1);
    pipeline.register(processor2);

    const results = await pipeline.processInParallel('input');

    expect(results).toEqual(['processed', 'parallel_processed']);
});

test('Pipeline registers and unregisters processors correctly', () => {
    const pipeline = new Pipeline<string, ProcessorType>();
    const processor = new MockProcessor();

    pipeline.register(processor);
    expect(pipeline.steps.length).toBe(1);

    pipeline.unregister(processor);
    expect(pipeline.steps.length).toBe(0);
});

test('Pipeline handles processing errors correctly', async () => {
    const pipeline = new Pipeline<string, ProcessorType>();
    const processor = new FailingProcessor();

    pipeline.register(processor);

    // Mock the log.error method to avoid actual logging during tests
    const logSpy = vi.spyOn(log, 'error').mockImplementation(() => {});

    await expect(pipeline.process('input')).rejects.toThrow('Processing failed');
    expect(logSpy).toHaveBeenCalled();

    logSpy.mockRestore();
});

test('Pipeline caches processor results correctly', async () => {
    const pipeline = new Pipeline<string, ProcessorType>();
    const processor = new MockProcessor();

    pipeline.register(processor);
    await pipeline.process('input');

    // Use the cached result
    const cachedResult = await pipeline.runProcessorByID(processor.id, 'input');
    expect(cachedResult).toBe('processed');

    // Verify that steps length remains 1 (no additional processor was added)
    expect(pipeline.steps.length).toBe(1);
});

test('Pipeline respects processor priorities', async () => {
    class PriorityProcessor extends Processor<string, ProcessorType> {
        get type(): ProcessorType {
            return ProcessorType.Extractor;
        }

        protected async _process(): Promise<string> {
            return 'priority_processed';
        }
    }

    const pipeline = new Pipeline<string, ProcessorType>();
    const processor1 = new MockProcessor({}, 'KKK');
    const processor2 = new PriorityProcessor({}, 'JJJ');

    pipeline.register(processor1);
    pipeline.register(processor2, 0);

    expect(await pipeline.steps[0].process()).toBe('priority_processed');
    expect(await pipeline.steps[1].process()).toBe('processed');
});
