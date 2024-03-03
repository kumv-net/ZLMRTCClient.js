// Rollup plugins
import { babel } from '@rollup/plugin-babel';
import eslint from '@rollup/plugin-eslint';
import replace from '@rollup/plugin-replace';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
const Path = require('path');
import json from '@rollup/plugin-json';

const pkg = require('./package.json');

export default {
    input: 'src/export.js',
    output: [
        {
            file: 'demo/ZLMRTCClient.js',
            format: 'iife',
            name: 'ZLMRTCClient',
            sourcemap: true // 'inline'
        }
    ],
    plugins: [
        replace({
            exclude: 'node_modules/**',
            include:['src/ulity/version.js'],
            preventAssignment:true,
            ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
            values:{
                __BUILD_DATE__: () => (new Date()).toString(),
                __VERSION__:pkg.version
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
                      "useBuiltIns":"usage",
                      "corejs":3,
                      "targets":{
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
