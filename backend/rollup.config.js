import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import babel from "rollup-plugin-babel";
import run from "rollup-plugin-run";
import { join } from "path";

export default {
  input: "src/index.js",
  output: {
    file: "../dist/server.js",
    format: "cjs",
  },
  plugins: [
    resolve(),
    commonjs(),
    babel({
      exclude: "node_modules/**",
    }),
    run({
      cwd: join(__dirname, "..", "dist"),
    }),
  ],
  external: filePath => !filePath.startsWith("."),
  watch: {
    clearScreen: false,
  },
};
