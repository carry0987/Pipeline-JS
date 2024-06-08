import { test, expect, vi } from 'vitest';
import { Processor } from '../src/index';
import { ProcessorType } from './type/types';

// MockProcessor class defined with generic types
class MockProcessor extends Processor<string, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Extractor;
    }

    protected async _process(): Promise<string> {
        return 'processed';
    }
}

test('Processor processes data correctly', async () => {
    const processor = new MockProcessor();
    const result = await processor.process();

    expect(result).toBe('processed');
});

test('Processor sets and updates properties correctly', () => {
    const processor = new MockProcessor({ prop1: 'value1' });

    processor.setProps({ prop2: 'value2' });
    expect(processor.props).toEqual({ prop1: 'value1', prop2: 'value2' });
});

test('Processor emits events correctly', async () => {
    const processor = new MockProcessor();
    const beforeProcessSpy = vi.fn();
    const afterProcessSpy = vi.fn();
    const errorSpy = vi.fn();

    processor.on('beforeProcess', beforeProcessSpy);
    processor.on('afterProcess', afterProcessSpy);
    processor.on('error', errorSpy);

    // Verify beforeProcess and afterProcess events
    const result = await processor.process();
    expect(result).toBe('processed');
    expect(beforeProcessSpy).toHaveBeenCalled();
    expect(afterProcessSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    // Verify error event
    class ErrorProcessor extends Processor<string, ProcessorType> {
        get type(): ProcessorType {
            return ProcessorType.Extractor;
        }

        protected async _process(): Promise<string> {
            throw new Error('Error!');
        }
    }

    const errorProcessor = new ErrorProcessor();
    errorProcessor.on('error', errorSpy);

    await expect(errorProcessor.process()).rejects.toThrow('Error!');
    expect(errorSpy).toHaveBeenCalled();
});

test('Processor generates unique IDs', () => {
    const processor1 = new MockProcessor();
    const processor2 = new MockProcessor();

    expect(processor1.id).not.toBe(processor2.id);
    expect(processor1.id).toMatch(/^[0-9a-fA-F-]{36}$/); // UUID format
});
