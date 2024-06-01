import { Pipeline } from '../src/module/pipeline';
import { Processor } from '../src/module/processor';
import { ProcessorType } from './type/types';
import log from '../src/module/utils/log';

class MockProcessor extends Processor<string, {}, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Extractor;
    }

    protected _process(): string {
        return 'processed';
    }
}

class FailingProcessor extends Processor<string, {}, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Transformer;
    }

    protected _process(): string {
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
    const logSpy = jest.spyOn(log, 'error').mockImplementation(() => {});

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
    const cachedResult = await pipeline.runProcessorByID(processor.id, 'input', false);
    expect(cachedResult).toBe('processed');

    // Verify that steps length remains 1 (no additional processor was added)
    expect(pipeline.steps.length).toBe(1);
});

test('Pipeline respects processor priorities', () => {
    class PriorityProcessor extends Processor<string, {}, ProcessorType> {
        get type(): ProcessorType {
            return ProcessorType.Extractor;
        }

        protected _process(): string {
            return 'priority_processed';
        }
    }

    const pipeline = new Pipeline<string, ProcessorType>();
    const processor1 = new MockProcessor({}, 'KKK');
    const processor2 = new PriorityProcessor({}, 'JJJ');

    pipeline.register(processor1);
    pipeline.register(processor2, 0);

    expect(pipeline.steps[0].process()).toBe('priority_processed');
    expect(pipeline.steps[1].process()).toBe('processed');
});
