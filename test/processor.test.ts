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

test('Processor processes data correctly', () => {
    const processor = new MockProcessor();
    const result = processor.process();

    expect(result).toBe('processed');
});
