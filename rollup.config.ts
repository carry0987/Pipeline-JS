import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import tsConfigPaths from 'rollup-plugin-tsconfig-paths';
import nodeResolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';
import del from 'rollup-plugin-delete';
import { createRequire } from 'module';

const pkg = createRequire(import.meta.url)('./package.json');
const isProduction = process.env.BUILD === 'production';
const sourceFile = 'src/index.ts';

// Common plugins for all builds
const commonPlugins = [
    typescript(),
    nodeResolve(),
    replace({
        preventAssignment: true,
        __version__: pkg.version
    }),
];

const jsConfig = {
    input: sourceFile,
    output: [
        {
            file: pkg.exports['.'].umd,
            format: 'umd',
            name: 'PipelineJS',
            plugins: isProduction ? [terser()] : []
        }
    ],
    plugins: commonPlugins
};

const esConfig = {
    input: sourceFile,
    output: [
        {
            file: pkg.exports['.'].import,
            format: 'es'
        }
    ],
    plugins: commonPlugins
};

const dtsConfig = {
    input: sourceFile,
    output: {
        file: pkg.exports['.'].types,
        format: 'es'
    },
    external: [/\.css$/u],
    plugins: [
        tsConfigPaths(),
        dts(),
        del({ hook: 'buildEnd', targets: 'dist/dts' })
    ]
};

export default [jsConfig, esConfig, dtsConfig];
