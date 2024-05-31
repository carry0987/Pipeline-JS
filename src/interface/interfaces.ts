import { PipelineProcessor } from '../module/processor';

export interface PipelineProcessorProps {}
export interface PipelineProcessorEvents {
    propsUpdated: <T, P extends Partial<PipelineProcessorProps>>(
        processor: PipelineProcessor<T, P>
    ) => void;
    beforeProcess: (...args: any[]) => void;
    afterProcess: (...args: any[]) => void;
}
