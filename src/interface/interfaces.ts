import { Processor } from '../module/processor';

export interface ProcessorProps {}
export interface ProcessorEvents {
    propsUpdated: <T, P extends Partial<ProcessorProps>, PT>(
        processor: Processor<T, P, PT>
    ) => void;
    beforeProcess: (...args: any[]) => void;
    afterProcess: (...args: any[]) => void;
}
