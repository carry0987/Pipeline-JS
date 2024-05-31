# Pipeline-JS
[![NPM](https://img.shields.io/npm/v/@carry0987/pipeline.svg)](https://www.npmjs.com/package/@carry0987/pipeline)  
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
import { Pipeline, PipelineProcessor } from '@carry0987/pipeline';

// Define custom processor types
enum CustomProcessorType {
    Init,
    ProcessA,
    ProcessB,
    Final
}

// Create custom processors by extending PipelineProcessor
class InitProcessor extends PipelineProcessor<string, {}, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.Init;
    }
    protected async _process(data: string): Promise<string> {
        return `Init: ${data}`;
    }
}

class ProcessA extends PipelineProcessor<string, {}, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.ProcessA;
    }
    protected async _process(data: string): Promise<string> {
        return `${data} | ProcessA`;
    }
}

class ProcessB extends PipelineProcessor<string, {}, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.ProcessB;
    }
    protected async _process(data: string): Promise<string> {
        return `${data} | ProcessB`;
    }
}

class FinalProcessor extends PipelineProcessor<string, {}, CustomProcessorType> {
    get type(): CustomProcessorType {
        return CustomProcessorType.Final;
    }
    protected async _process(data: string): Promise<string> {
        return `${data} | Final`;
    }
}

// Initialize the pipeline with custom processors
const pipeline = new Pipeline<string, CustomProcessorType, CustomProcessorType>();

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
- **constructor(steps?: PipelineProcessor<unknown, Partial<PipelineProcessorProps>, PT>[])**
  Initializes a new pipeline with optional initial steps.

- **clearCache()**
  Clears the pipeline's cache.

- **register<U, P extends Partial<PipelineProcessorProps>, PT extends T>(processor: PipelineProcessor<U, P, PT>, priority: number = -1): PipelineProcessor<U, P, PT>**
  Registers a new processor in the pipeline.

- **tryRegister<U, P extends Partial<PipelineProcessorProps>, PT extends T>(processor: PipelineProcessor<U, P, PT>, priority: number = -1): PipelineProcessor<U, P, PT> | undefined**
  Attempts to register a new processor, returns undefined if registration fails.

- **unregister<U, P extends Partial<PipelineProcessorProps>, X extends T>(processor: PipelineProcessor<U, P, X>): void**
  Unregisters a processor from the pipeline.

- **process(data?: R): Promise<R>**
  Runs all registered processors and returns the final output.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request with your changes.

## License
MIT
