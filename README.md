# Pipeline-JS
[![NPM](https://img.shields.io/npm/v/@carry0987/pipeline.svg)](https://www.npmjs.com/package/@carry0987/pipeline) ![CI](https://github.com/carry0987/Pipeline-JS/actions/workflows/ci.yml/badge.svg)  

**`@carry0987/pipeline`** is a highly modular and efficient pipeline processing system designed for managing and executing a series of processing steps. It allows users to register various types of processors, prioritize their execution order, and handle events such as processor registration, property updates, and processing completion. The system also includes a caching mechanism to avoid redundant processing, making it ideal for complex data transformation and processing workflows.

## Features
- **Modular Design**: Easily register and manage different types of processors.
- **Event-Driven**: Utilize event emitters to handle various pipeline events.
- **Caching Mechanism**: Avoid redundant processing with built-in caching.
- **Flexible Configuration**: Customize and extend the pipeline according to your needs.

## Installation
Install the package via npm:

```bash
npm i @carry0987/pipeline -D
```

## Usage
Here's a basic example of how to create and use a pipeline:

```typescript
import { Pipeline, Processor } from '@carry0987/pipeline';

// Define custom processor types
enum CustomProcessorType {
    Init,
    ProcessA,
    ProcessB,
    Final
}

// Create custom processors by extending Processor
class InitProcessor extends Processor<string, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.Init;
    }
    protected async _process(data: string): Promise<string> {
        return `Init: ${data}`;
    }
}

class ProcessA extends Processor<string, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.ProcessA;
    }
    protected async _process(data: string): Promise<string> {
        return `${data} | ProcessA`;
    }
}

class ProcessB extends Processor<string, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.ProcessB;
    }
    protected async _process(data: string): Promise<string> {
        return `${data} | ProcessB`;
    }
}

class FinalProcessor extends Processor<string, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.Final;
    }
    protected async _process(data: string): Promise<string> {
        return `${data} | Final`;
    }
}

// Initialize the pipeline with custom processors
const pipeline = new Pipeline<string, CustomProcessorType>();

pipeline.register(new InitProcessor());
pipeline.register(new ProcessA());
pipeline.register(new ProcessB());
pipeline.register(new FinalProcessor(), 10); // You can also set the priority

async function runPipeline() {
    const result = await pipeline.process('Start');
    console.log(result); // Output should be something like: "Init: Start | ProcessA | ProcessB | Final"
}

runPipeline();
```

## API
### Pipeline
#### Methods
- **`constructor(steps?: Processor<R, PT, Partial<ProcessorProps>>[])`**
  Initializes a new pipeline with optional initial steps.

- **`clearCache(): void`**
  Clears the pipeline's cache.

- **`register<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>, priority: number = -1): Processor<R, PT, P>`**
  Registers a new processor in the pipeline.

- **`tryRegister<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>, priority: number): Processor<R, PT, P> | undefined`**
  Attempts to register a new processor, returns undefined if registration fails.

- **`unregister<P extends Partial<ProcessorProps>>(processor: Processor<R, PT, P>): void`**
  Unregisters a processor from the pipeline.

- **`process(data?: R): Promise<R | undefined>`**
  Runs all registered processors and returns the final output.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request with your changes.

## License
MIT
