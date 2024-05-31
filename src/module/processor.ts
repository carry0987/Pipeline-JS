import { generateUUID, ID } from './utils/id';
import { EventEmitter } from '@carry0987/event-emitter';
import { deepEqual } from './utils/deepEqual';
import { ProcessorEvents, ProcessorProps } from '../interface/interfaces';

// The order of enum items define the processing order of the processor type
// e.g. Extractor = 0 will be processed before Transformer = 1
abstract class Processor<T, P extends Partial<ProcessorProps>, PT> extends EventEmitter<ProcessorEvents> {
    public readonly id: ID;
    public readonly name: string;
    private _props: P;
    private _status: 'idle' | 'running' | 'completed';

    abstract get type(): PT;
    protected abstract _process(...args: any[]): T | Promise<T>;
    protected validateProps?(...args: any[]): void;

    constructor(props?: Partial<P>, name?: string) {
        super();

        this._props = {} as P;
        this._status = 'idle';
        this.id = generateUUID();
        this.name = name || 'Unnamed Processor';

        if (props) this.setProps(props);
    }

    /**
     * process is used to call beforeProcess and afterProcess callbacks
     * This function is just a wrapper that calls _process()
     *
     * @param args
     */
    public process(...args: any[]): T | Promise<T> {
        if (this.validateProps instanceof Function) {
            this.validateProps(...args);
        }

        this._status = 'running';
        this.emit('beforeProcess', ...args);
        let result: T | Promise<T>;

        try {
            result = this._process(...args);
        } catch (error) {
            this._status = 'idle';
            throw error;
        }

        if (result instanceof Promise) {
            return result.then((res) => {
                this._status = 'completed';
                this.emit('afterProcess', ...args);
                return res;
            }).catch((error) => {
                this._status = 'idle';
                throw error;
            });
        } else {
            this._status = 'completed';
            this.emit('afterProcess', ...args);
            return result;
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

    public get status(): typeof Processor.prototype._status {
        return this._status;
    }
}

export { Processor };
