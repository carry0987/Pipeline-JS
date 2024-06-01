import { generateUUID, ID } from './utils/id';
import { EventEmitter } from '@carry0987/event-emitter';
import { deepEqual } from './utils/deepEqual';
import { ProcessorProps } from '../interface/interfaces';
import { ProcessorEvents } from '../interface/events';

// The order of enum items define the processing order of the processor type
// e.g. Extractor = 0 will be processed before Transformer = 1
abstract class Processor<T, P extends Partial<ProcessorProps>, PT> extends EventEmitter<ProcessorEvents> {
    public readonly id: ID;
    public readonly name?: string;
    private static readonly _statusTypes = ['idle', 'running', 'completed'] as const;
    private _props: P;
    private _status: typeof Processor._statusTypes[number];

    abstract get type(): PT;
    protected abstract _process(...args: any[]): Promise<T>;
    protected validateProps?(...args: any[]): void;

    constructor(props?: Partial<P>, name?: string) {
        super();

        this._props = {} as P;
        this._status = 'idle';
        this.id = generateUUID();
        this.name = name;

        if (props) this.setProps(props);
    }

    /**
     * process is used to call beforeProcess and afterProcess callbacks
     * This function is just a wrapper that calls _process()
     *
     * @param args
     */
    public async process(...args: any[]): Promise<T> {
        if (this.validateProps instanceof Function) {
            this.validateProps(...args);
        }
    
        this._status = 'running';
        this.emit('beforeProcess', ...args);
    
        try {
            const result = await this._process(...args);
            this._status = 'completed';
            this.emit('afterProcess', ...args);
            return result;
        } catch (error: unknown) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            this._status = 'idle';
            this.emit('error', errorObj, ...args);
            this.emit('afterProcess', ...args);
            throw errorObj;
        }
    }

    public setProps(props: Partial<P>): this {
        const updatedProps = {
            ...this._props,
            ...props,
        };

        if (!deepEqual(updatedProps, this._props)) {
            this._props = updatedProps;
            this.emit('propsUpdated', this);
        }

        return this;
    }

    public get props(): P {
        return this._props;
    }

    public get status(): typeof Processor._statusTypes[number] {
        return this._status;
    }
}

export { Processor };
