/** 用法：node --import ./packages/shared/src/domains/node-loader.mjs --test packages/shared/src/domains/domains.test.mjs */
import { register } from "node:module";
register("./resolve-ts-hook.mjs", import.meta.url);
