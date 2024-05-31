import { Pipeline } from '../src/module/pipeline';
import { PipelineProcessor } from '../src/module/processor';
import { ProcessorType } from './type/types';

// MockProcessor class defined with generic types
class MockProcessor extends PipelineProcessor<string, {}, ProcessorType> {
    get type(): ProcessorType {
        return ProcessorType.Extractor;
    }

    protected _process(): string {
        return 'processed';
    }
}

test('Pipeline processes data correctly', async () => {
    const pipeline = new Pipeline<string, ProcessorType, ProcessorType>();
    const processor = new MockProcessor();

    pipeline.register(processor);
    const result = await pipeline.process('input');

    expect(result).toBe('processed');
});
