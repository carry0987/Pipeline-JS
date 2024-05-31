import { Processor } from '../src/module/processor';
import { ProcessorType } from './type/types';

// MockProcessor class defined with generic types
class MockProcessor extends Processor<string, {}, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Extractor;
    }

    protected _process(): string {
        return 'processed';
    }
}

test('Processor processes data correctly', () => {
    const processor = new MockProcessor();
    const result = processor.process();

    expect(result).toBe('processed');
});
