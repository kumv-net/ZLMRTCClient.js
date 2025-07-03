// Rollup plugins
import { babel } from '@rollup/plugin-babel';
import eslint from '@rollup/plugin-eslint';
import replace from '@rollup/plugin-replace';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import pkg from './package.json' assert { type: "json" };
import terser from '@rollup/plugin-terser';

const isProd = true;
export default {
    input: 'src/export-zlm.js',
    output: [
        {
            file: 'demo/ZLMRTCClient.js',
            format: 'iife',
            name: 'ZLMRTCClient',
            sourcemap: true, // 'inline'
            plugins: [
                // 输出阶段专属插件
                isProd && terser({
                    compress: {
                        // 删除 console / debugger
                        drop_console: true,
                        drop_debugger: true,
                    },
                    format: {
                        // 移除所有注释
                        comments: false,
                    },
                    mangle: {
                        // 可按需保留类名 / 函数名
                        // keep_classnames: true,
                        // keep_fnames: true,
                    },
                }),
            ].filter(Boolean),
        }
    ],
    plugins: [
        replace({
            exclude: 'node_modules/**',
            include: ['src/ulity/version.js'],
            preventAssignment: true,
            ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
            values: {
                __BUILD_DATE__: () => (new Date()).toString(),
                __VERSION__: pkg.version
            }
        }),
        nodeResolve({
            browser: true,
        }),
        json(),
        commonjs(),
        babel({
            exclude: 'node_modules/**',
            presets: [
                [
                    "@babel/preset-env",
                    {
                        "useBuiltIns": "usage",
                        "corejs": 3,
                        "targets": {
                            "browsers": [
                                "ios >= 9",
                                "chrome >= 65",
                            ]
                        }
                    }

                ]
            ]

        }),
        (process.env.NODE_ENV === 'production'),
    ],
};
