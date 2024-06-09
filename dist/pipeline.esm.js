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
    emit(event, ...args) {
        const eventName = event;
        // Initialize the event
        this.init(eventName);
        // If there are no callbacks, return false
        if (this.callbacks[eventName].length <= 0) {
            return false;
        }
        // Get all results
        const results = this.callbacks[eventName].map(callback => {
            try {
                // Execute callback and capture the result
                const result = callback(...args);
                // If result is a promise, wrap it in Promise.resolve to handle uniformly
                return result instanceof Promise ? result : Promise.resolve(result);
            }
            catch (e) {
                console.error(`Error in event listener for event: ${eventName}`, e); // Logging error
                // Even if an error occurs, continue processing other callbacks
                return Promise.resolve();
            }
        });
        // Check if any result is a promise
        const hasPromise = results.some(result => result instanceof Promise);
        // If there is at least one promise, return a promise that resolves when all promises resolve
        if (hasPromise) {
            return Promise.all(results).then(() => true).catch((e) => {
                console.error(`Error handling promises for event: ${eventName}`, e); // Logging error
                return false;
            });
        }
        else {
            // If no promises, return true
            return true;
        }
    }
    once(event, listener) {
        this.checkListener(listener);
        const onceListener = (...args) => {
            // Use a sync wrapper to ensure the listener is removed immediately after execution
            const result = listener(...args);
            // Remove the listener immediately
            this.off(event, onceListener);
            // Handle async listeners by wrapping the result in Promise.resolve
            return result instanceof Promise ? result : Promise.resolve(result);
        };
        return this.on(event, onceListener);
    }
}

class Pipeline extends EventEmitter {
    // Available steps for this pipeline
    _steps = new Map();
    // Used to cache the results of processors using their id field
    cache = new Map();
    // Keeps the index of the last updated processor in the registered
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
        processor.on('propsUpdated', this.processorPropsUpdated.bind(this, processor));
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
            // Remove the event listener
            processor.off('propsUpdated', this.processorPropsUpdated.bind(this, processor));
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
        if (priority < 0 || priority >= subSteps.length) {
            subSteps.push(processor);
        }
        else {
            subSteps.splice(priority, 0, processor);
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
                    prev = await processor.process(prev);
                    this.cache.set(processor.id, prev);
                }
                else {
                    // Cached results already exist
                    prev = this.cache.get(processor.id);
                    if (prev === undefined) {
                        prev = await processor.process(prev);
                    }
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
     * Removes all processors from the pipeline
     */
    clearProcessors() {
        this._steps.clear();
        this.clearCache();
    }
    /**
     * Returns processor by ID
     *
     * @param id
     */
    getProcessorByID(processorID) {
        const index = this.findProcessorIndexByID(processorID);
        return index > -1 ? this.steps[index] : null;
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
     * Runs a processor by its ID
     *
     * @param processorID
     * @param data
     * @param rerunAllFollowing (optional) if true, rerun all processors following the specified processor
     */
    async runProcessorByID(processorID, data, runAllFollowing = true) {
        const processorIndex = this.findProcessorIndexByID(processorID);
        if (processorIndex === -1) {
            throw Error(`Processor ID ${processorID} not found`);
        }
        if (runAllFollowing) {
            this.lastProcessorIndexUpdated = processorIndex;
            // Clear cache for all processors after the rerun processor
            this.clearCacheAfterProcessorIndex(processorIndex);
        }
        else {
            // If not re-running all, just clear the cache for the specific processor
            this.cache.delete(processorID);
        }
        return this.process(data);
    }
    /**
     * Clears the cache for all processors after the specified index
     *
     * @param index
     */
    clearCacheAfterProcessorIndex(index) {
        this.steps.slice(index).forEach(processor => {
            this.cache.delete(processor.id);
        });
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

function deepEqual(obj1, obj2) {
    if (typeof obj1 !== typeof obj2)
        return false;
    if (obj1 === null || obj2 === null)
        return obj1 === obj2;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
        return obj1 === obj2;
    }
    if (obj1 instanceof Date && obj2 instanceof Date) {
        return obj1.getTime() === obj2.getTime();
    }
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        if (obj1.length !== obj2.length)
            return false;
        return obj1.every((item, index) => deepEqual(item, obj2[index]));
    }
    if (Array.isArray(obj1) || Array.isArray(obj2))
        return false;
    if (obj1 instanceof Set && obj2 instanceof Set) {
        if (obj1.size !== obj2.size)
            return false;
        for (const item of obj1) {
            if (!obj2.has(item))
                return false;
        }
        return true;
    }
    if (obj1 instanceof Map && obj2 instanceof Map) {
        if (obj1.size !== obj2.size)
            return false;
        for (const [key, value] of obj1) {
            if (!deepEqual(value, obj2.get(key)))
                return false;
        }
        return true;
    }
    if (Object.getPrototypeOf(obj1) !== Object.getPrototypeOf(obj2))
        return false;
    const keys1 = Reflect.ownKeys(obj1);
    const keys2 = Reflect.ownKeys(obj2);
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (!deepEqual(obj1[key], obj2[key]))
            return false;
    }
    return true;
}
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// The order of enum items define the processing order of the processor type
// e.g. Extractor = 0 will be processed before Transformer = 1
class Processor extends EventEmitter {
    id;
    name;
    static _statusTypes = ['idle', 'running', 'completed'];
    _props;
    _status;
    constructor(props, name) {
        super();
        this._props = {};
        this._status = 'idle';
        this.id = generateUUID();
        this.name = name;
        if (props)
            this.setProps(props);
    }
    /**
     * process is used to call beforeProcess and afterProcess callbacks
     * This function is just a wrapper that calls _process()
     *
     * @param args
     */
    async process(...args) {
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
        }
        catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            this._status = 'idle';
            this.emit('error', errorObj, ...args);
            this.emit('afterProcess', ...args);
            throw errorObj;
        }
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
    get status() {
        return this._status;
    }
}

const version = '1.2.10';

export { Pipeline, Processor, version };
