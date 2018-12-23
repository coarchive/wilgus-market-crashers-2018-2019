import resolve from "rollup-plugin-node-resolve";
import babel from "rollup-plugin-babel";
import run from "rollup-plugin-run";
import { join } from "path";

const crasher = join(__dirname, "..");
export default {
  input: "src/index.js",
  output: {
    file: "../dist/server.js",
    format: "cjs",
  },
  plugins: [
    resolve(),
    babel({
      exclude: "node_modules/**",
    }),
    run({
      cwd: join(crasher, "dist"),
    }),
  ],
  external: path => !(path.includes(crasher) || path.startsWith(".")),
  watch: {
    clearScreen: false,
  },
};
