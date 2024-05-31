/**
 * Centralized logging lib
 *
 * This class needs some improvements but so far it has been used to have a coherent way to log
 */
class Logger {
    format(message, type) {
        return `[Pipeline-JS] [${type.toUpperCase()}]: ${message}`;
    }
    error(message, throwException = false) {
        const msg = this.format(message, 'error');
        if (throwException) {
            throw Error(msg);
        }
        else {
            console.error(msg);
        }
    }
    warn(message) {
        console.warn(this.format(message, 'warn'));
    }
    info(message) {
        console.info(this.format(message, 'info'));
    }
}
var log = new Logger();

class EventEmitter {
    // Initialize callbacks with an empty object
    callbacks = {};
    init(event) {
        if (event && !this.callbacks[event]) {
            this.callbacks[event] = [];
        }
    }
    checkListener(listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('The listener must be a function');
        }
    }
    hasEvent(event) {
        return this.callbacks[event] !== undefined;
    }
    listeners() {
        return this.callbacks;
    }
    addListener(event, listener) {
        return this.on(event, listener);
    }
    clearListener(event) {
        if (event) {
            this.callbacks[event] = [];
        }
        else {
            this.callbacks = {};
        }
        return this;
    }
    on(event, listener) {
        this.checkListener(listener);
        this.init(event);
        this.callbacks[event].push(listener);
        return this;
    }
    off(event, listener) {
        this.checkListener(listener);
        const eventName = event;
        this.init();
        if (!this.callbacks[eventName] || this.callbacks[eventName].length === 0) {
            // There is no callbacks with this key
            return this;
        }
        this.callbacks[eventName] = this.callbacks[eventName].filter((value) => value != listener);
        return this;
    }
    async emit(event, ...args) {
        const eventName = event;
        // Initialize the event
        this.init(eventName);
        // If there are callbacks for this event
        if (this.callbacks[eventName].length > 0) {
            // Execute all callbacks and wait for them to complete if they are promises
            await Promise.all(this.callbacks[eventName].map(async (value) => await value(...args)));
            return true;
        }
        return false;
    }
    once(event, listener) {
        this.checkListener(listener);
        const onceListener = async (...args) => {
            await listener(...args);
            this.off(event, onceListener);
        };
        return this.on(event, onceListener);
    }
}

class Pipeline extends EventEmitter {
    // available steps for this pipeline
    _steps = new Map();
    // used to cache the results of processors using their id field
    cache = new Map();
    // keeps the index of the last updated processor in the registered
    // processors list and will be used to invalidate the cache
    // -1 means all new processors should be processed
    lastProcessorIndexUpdated = -1;
    constructor(steps) {
        super();
        if (steps) {
            steps.forEach((step) => this.register(step));
        }
    }
    /**
     * Clears the `cache` array
     */
    clearCache() {
        this.cache = new Map();
        this.lastProcessorIndexUpdated = -1;
    }
    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    register(processor, priority = -1) {
        if (!processor) {
            throw Error('Processor is not defined');
        }
        if (processor.type === null) {
            throw Error('Processor type is not defined');
        }
        if (this.findProcessorIndexByID(processor.id) > -1) {
            throw Error(`Processor ID ${processor.id} is already defined`);
        }
        // Binding the propsUpdated callback to the Pipeline
        processor.on('propsUpdated', this.processorPropsUpdated.bind(this));
        this.addProcessorByPriority(processor, priority);
        this.afterRegistered(processor);
        return processor;
    }
    /**
     * Tries to register a new processor
     * @param processor
     * @param priority
     */
    tryRegister(processor, priority) {
        try {
            return this.register(processor, priority);
        }
        catch (_) {
            return undefined;
        }
    }
    /**
     * Removes a processor from the list
     *
     * @param processor
     */
    unregister(processor) {
        if (!processor)
            return;
        if (this.findProcessorIndexByID(processor.id) === -1)
            return;
        const subSteps = this._steps.get(processor.type);
        if (subSteps && subSteps.length) {
            this._steps.set(processor.type, subSteps.filter((proc) => proc.id !== processor.id));
            this.emit('updated', processor);
        }
    }
    /**
     * Registers a new processor
     *
     * @param processor
     * @param priority
     */
    addProcessorByPriority(processor, priority = -1) {
        let subSteps = this._steps.get(processor.type);
        if (!subSteps) {
            const newSubStep = [];
            this._steps.set(processor.type, newSubStep);
            subSteps = newSubStep;
        }
        if (priority === null || priority < 0) {
            subSteps.push(processor);
        }
        else {
            if (!subSteps[priority]) {
                // Slot is empty
                subSteps[priority] = processor;
            }
            else {
                // Slot is NOT empty
                const first = subSteps.slice(0, priority - 1);
                const second = subSteps.slice(priority + 1);
                this._steps.set(processor.type, first.concat(processor).concat(second));
            }
        }
    }
    /**
     * Flattens the _steps Map and returns a list of steps with their correct priorities
     */
    get steps() {
        let steps = [];
        for (const type of this.getSortedProcessorTypes()) {
            const subSteps = this._steps.get(type);
            if (subSteps && subSteps.length) {
                steps = steps.concat(subSteps);
            }
        }
        // To remove any undefined elements
        return steps.filter((s) => s);
    }
    /**
     * Accepts ProcessType and returns an array of the registered processes
     * with the give type
     *
     * @param type
     */
    getStepsByType(type) {
        return this.steps.filter((process) => process.type === type);
    }
    /**
     * Returns a list of ProcessorType according to their priority
     */
    getSortedProcessorTypes() {
        return Array.from(this._steps.keys());
    }
    /**
     * Runs all registered processors based on their correct priority
     * and returns the final output after running all steps
     *
     * @param data
     */
    async process(data) {
        const lastProcessorIndexUpdated = this.lastProcessorIndexUpdated;
        const steps = this.steps;
        let prev = data;
        try {
            for (const processor of steps) {
                const processorIndex = this.findProcessorIndexByID(processor.id);
                if (processorIndex >= lastProcessorIndexUpdated) {
                    // We should execute process() here since the last
                    // updated processor was before "processor".
                    // This is to ensure that we always have correct and up to date
                    // data from processors and also to skip them when necessary
                    prev = (await processor.process(prev));
                    this.cache.set(processor.id, prev);
                }
                else {
                    // Cached results already exist
                    prev = this.cache.get(processor.id);
                }
            }
        }
        catch (e) {
            log.error(e);
            // Trigger the onError callback
            this.emit('error', prev);
            throw e;
        }
        // Means the pipeline is up to date
        this.lastProcessorIndexUpdated = steps.length;
        // Triggers the afterProcess callbacks with the results
        this.emit('afterProcess', prev);
        return prev;
    }
    /**
     * Returns the registered processor's index in _steps array
     *
     * @param processorID
     */
    findProcessorIndexByID(processorID) {
        return this.steps.findIndex((p) => p.id == processorID);
    }
    /**
     * Sets the last updates processors index locally
     * This is used to invalid or skip a processor in
     * the process() method
     */
    setLastProcessorIndex(processor) {
        const processorIndex = this.findProcessorIndexByID(processor.id);
        if (this.lastProcessorIndexUpdated > processorIndex) {
            this.lastProcessorIndexUpdated = processorIndex;
        }
    }
    processorPropsUpdated(processor) {
        this.setLastProcessorIndex(processor);
        this.emit('propsUpdated');
        this.emit('updated', processor);
    }
    afterRegistered(processor) {
        this.setLastProcessorIndex(processor);
        this.emit('afterRegister');
        this.emit('updated', processor);
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Returns true if both objects are equal
 * @param obj1 left object
 * @param obj2 right object
 * @returns boolean
 */
function deepEqual(obj1, obj2) {
    // If objects are not the same type, return false
    if (typeof obj1 !== typeof obj2)
        return false;
    // If objects are both null or undefined, return true
    if (obj1 === null || obj2 === null)
        return obj1 === obj2;
    // If objects are both primitive types, compare them directly
    if (typeof obj1 !== 'object' && typeof obj2 !== 'object') {
        return obj1 === obj2;
    }
    // If objects are arrays, compare their elements recursively
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        if (obj1.length !== obj2.length)
            return false;
        return obj1.every((item, index) => deepEqual(item, obj2[index]));
    }
    // If one is array and the other is not, return false
    if (Array.isArray(obj1) || Array.isArray(obj2))
        return false;
    // If objects are both objects, compare their properties recursively
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (!deepEqual(obj1[key], obj2[key]))
            return false;
    }
    return true;
}

// The order of enum items define the processing order of the processor type
// e.g. Extractor = 0 will be processed before Transformer = 1
class Processor extends EventEmitter {
    id;
    _props;
    constructor(props) {
        super();
        this._props = {};
        this.id = generateUUID();
        if (props)
            this.setProps(props);
    }
    /**
     * process is used to call beforeProcess and afterProcess callbacks
     * This function is just a wrapper that calls _process()
     *
     * @param args
     */
    process(...args) {
        if (this.validateProps instanceof Function) {
            this.validateProps(...args);
        }
        this.emit('beforeProcess', ...args);
        const result = this._process(...args);
        this.emit('afterProcess', ...args);
        return result;
    }
    setProps(props) {
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
    get props() {
        return this._props;
    }
}

const version = '1.1.0';

export { Pipeline, Processor, version };
