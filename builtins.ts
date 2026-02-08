import {
  SchemeId,
  SCons,
  Frame,
  SchemeBuiltin,
  SchemeClosure,
  SchemeType,
} from "./types";
import { sexpToStr } from "./analyzer";

export function initEnv(): Frame {
  const env = new Frame(null);
  env.set(
    "+",
    new SchemeBuiltin((args) =>
      args.reduce(
        (acc, val) => (acc as number) + (val as number),
        0 as SchemeType,
      ),
    ),
  );
  env.set(
    "-",
    new SchemeBuiltin((args) =>
      args
        .slice(1)
        .reduce((acc, val) => (acc as number) - (val as number), args[0]),
    ),
  );
  env.set(
    "*",
    new SchemeBuiltin((args) =>
      args.reduce(
        (acc, val) => (acc as number) * (val as number),
        1 as SchemeType,
      ),
    ),
  );
  env.set(
    "/",
    new SchemeBuiltin((args) =>
      args
        .slice(1)
        .reduce((acc, val) => (acc as number) / (val as number), args[0]),
    ),
  );

  env.set(
    "abs",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("abs: Expected one argument.");
      return Math.abs(args[0] as number);
    }),
  );

  env.set(
    "sqrt",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("sqrt: Expected one argument.");
      return Math.sqrt(args[0] as number);
    }),
  );

  env.set(
    "remainder",
    new SchemeBuiltin((args) => {
      if (args.length !== 2)
        throw new Error("remainder: Expected two arguments.");
      const a = args[0] as number;
      const b = args[1] as number;
      return a % b;
    }),
  );

  env.set(
    "modulo",
    new SchemeBuiltin((args) => {
      if (args.length !== 2)
        throw new Error("modulo: Expected two arguments.");
      const a = args[0] as number;
      const b = args[1] as number;
      return ((a % b) + b) % b;
    }),
  );

  env.set(
    "floor",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("floor: Expected one argument.");
      return Math.floor(args[0] as number);
    }),
  );

  env.set(
    "ceiling",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("ceiling: Expected one argument.");
      return Math.ceil(args[0] as number);
    }),
  );

  env.set(
    "truncate",
    new SchemeBuiltin((args) => {
      if (args.length !== 1)
        throw new Error("truncate: Expected one argument.");
      return Math.trunc(args[0] as number);
    }),
  );

  env.set(
    "round",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("round: Expected one argument.");
      return Math.round(args[0] as number);
    }),
  );

  env.set(
    "cons",
    new SchemeBuiltin((args) => {
      if (args.length !== 2) throw new Error("cons: Expected two arguments.");
      return new SCons(args[0], args[1]);
    }),
  );

  env.set(
    "car",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("car: Expected one argument.");
      if (!(args[0] instanceof SCons))
        throw new Error("car: Expected a cons cell.");
      return args[0].car;
    }),
  );

  env.set(
    "cdr",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("cdr: Expected one argument.");
      if (!(args[0] instanceof SCons))
        throw new Error("cdr: Expected a cons cell.");
      return args[0].cdr;
    }),
  );

  env.set(
    "log",
    new SchemeBuiltin((args) => {
      const argsStr = args.map((sexp) => {
        if (typeof sexp === "string") {
          return sexp;
        } else {
          return sexpToStr(sexp);
        }
      });
      console.log(...argsStr);
      return true;
    }),
  );

  env.set(
    "eq?",
    new SchemeBuiltin((args) => {
      if (args.length < 2)
        throw new Error("eq?: Expected at least two arguments.");
      for (let i = 1; i < args.length; i++) {
        const a = args[i - 1];
        const b = args[i];
        if (a === b) continue;
        if (a instanceof SchemeId && b instanceof SchemeId && a.id === b.id)
          continue;
        return false;
      }
      return true;
    }),
  );

  env.set(
    "eqv?",
    new SchemeBuiltin((args) => {
      if (args.length < 2)
        throw new Error("eqv?: Expected at least two arguments.");
      for (let i = 1; i < args.length; i++) {
        const a = args[i - 1];
        const b = args[i];
        if (a === b) continue;
        if (a instanceof SchemeId && b instanceof SchemeId && a.id === b.id)
          continue;
        return false;
      }
      return true;
    }),
  );

  env.set(
    "<",
    new SchemeBuiltin((args) => {
      if (args.length < 2)
        throw new Error("<: Expected at least two arguments.");
      for (let i = 1; i < args.length; i++) {
        if (!((args[i - 1] as number) < (args[i] as number))) return false;
      }
      return true;
    }),
  );

  env.set(
    ">",
    new SchemeBuiltin((args) => {
      if (args.length < 2)
        throw new Error(">: Expected at least two arguments.");
      for (let i = 1; i < args.length; i++) {
        if (!((args[i - 1] as number) > (args[i] as number))) return false;
      }
      return true;
    }),
  );

  env.set(
    "null?",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("null?: Expected one argument.");
      return args[0] === null;
    }),
  );

  env.set(
    "pair?",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("null?: Expected one argument.");
      return args[0] instanceof SCons;
    }),
  );

  env.set(
    "list?",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("list?: Expected one argument.");
      return args[0] instanceof SCons;
    }),
  );

  env.set(
    "symbol?",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("symbol?: Expected one argument.");
      return args[0] instanceof SchemeId;
    }),
  );

  env.set(
    "procedure?",
    new SchemeBuiltin((args) => {
      if (args.length !== 1) throw new Error("procedure?: Expected one argument.");
      return args[0] instanceof SchemeClosure || args[0] instanceof SchemeBuiltin;
    }),
  );

  env.set(
    "apply",
    new SchemeBuiltin((args) => {
      if (args.length < 2)
        throw new Error("apply: Expected at least two arguments.");
      const func = args[0];
      const lastArg = args[args.length - 1];
      if (lastArg !== null && !(lastArg instanceof SCons))
        throw new Error("apply: Last argument must be a list.");
      // Collect intermediate args and spread the final list
      const intermediate = args.slice(1, -1);
      const finalArgs: SchemeType[] = [...intermediate];
      let current: SCons | null = lastArg as SCons | null;
      while (current !== null) {
        finalArgs.push(current.car);
        current = current.cdr as SCons | null;
      }
      if (func instanceof SchemeBuiltin) {
        return func.eval(finalArgs);
      } else if (func instanceof SchemeClosure) {
        return func.eval(finalArgs);
      } else {
        throw new Error("apply: First argument must be a function.");
      }
    }),
  );

  return env;
}
