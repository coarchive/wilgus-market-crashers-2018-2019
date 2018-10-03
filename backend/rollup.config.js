import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import run from 'rollup-plugin-run';
import path from 'path';

export default {
  input: 'src/index.js',
  output: {
    file: '../dist/server.js',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    commonjs(),
    babel({
      exclude: 'node_modules/**'
    }),
    run({
      cwd: path.join(__dirname, '..', 'dist')
    })
  ],
  external: path => !path.startsWith('.'),
  watch: {
    clearScreen: false
  }
};
