import { PipelineProcessor } from '../module/processor';

export interface PipelineProcessorProps {}
export interface PipelineProcessorEvents {
    propsUpdated: <T, P extends Partial<PipelineProcessorProps>, PT>(
        processor: PipelineProcessor<T, P, PT>
    ) => void;
    beforeProcess: (...args: any[]) => void;
    afterProcess: (...args: any[]) => void;
}
