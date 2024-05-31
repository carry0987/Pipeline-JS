import Pipeline from '../src/module/pipeline';
import { PipelineProcessor } from '../src/module/processor';
import { ProcessorType } from '../src/type/types';

class MockProcessor extends PipelineProcessor<string, {}> {
    get type() {
        return ProcessorType.Extractor;
    }
    protected _process() {
        return 'processed';
    }
}

test('Pipeline processes data correctly', async () => {
    const pipeline = new Pipeline<string>();
    const processor = new MockProcessor();

    pipeline.register(processor);
    const result = await pipeline.process('input');

    expect(result).toBe('processed');
});
