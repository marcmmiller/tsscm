// Re-export lexer types for backwards compatibility
export { TokenType, Token, InputStream, Lexer } from "./lexer";
import { TokenType, Token, InputStream, Lexer } from "./lexer";

//
// Type System
//
export class SchemeId {
  constructor(public id: string) {}
}

export class SCons {
  constructor(
    public car: SchemeType,
    public cdr: SchemeType,
  ) {}

  *[Symbol.iterator](): Iterator<SchemeType> {
    let current: SchemeType = this;
    while (current instanceof SCons) {
      yield current.car;
      current = current.cdr;
    }
  }
}

class SchemeBuiltin {
  constructor(public func: (args: SchemeType[]) => SchemeType) {}
  public eval(args: SchemeType[]): SchemeType {
    return this.func(args);
  }
}

class SchemeClosure {
  constructor(
    protected params: string[],
    protected restParam: string | null,
    protected expr: (frame: Frame) => SchemeType,
    protected env: Frame,
  ) {}

  public eval(args: SchemeType[]): SchemeType {
    const frame = new Frame(this.env);
    for (let i = 0; i < this.params.length; i++) {
      frame.set(this.params[i], args[i]);
    }
    if (this.restParam != null) {
      const restArgs = args.slice(this.params.length);
      const restList = restArgs.reverse().reduce((accumulator, current) => {
        return new SCons(current, accumulator);
      }, null);
      frame.set(this.restParam, restList);
    }
    return this.expr(frame);
  }
}

export type SchemeType =
  | SchemeId
  | SchemeBuiltin
  | SchemeClosure
  | SCons
  | number
  | string
  | boolean
  | null;

function safeCar(s: SchemeType): SchemeType {
  if (s instanceof SCons) {
    return s.car;
  } else {
    throw new Error("car: Expected cons.");
  }
}

function safeCdr(s: SchemeType): SchemeType {
  if (s instanceof SCons) {
    return s.cdr;
  } else {
    throw new Error("cdr: Expected cons.");
  }
}

function safeId(s: SchemeType): SchemeId {
  if (s instanceof SchemeId) {
    return s;
  } else {
    throw new Error("id: Expected identifier.");
  }
}

function printListTail(sexp: SchemeType): string {
  if (sexp === null) {
    return "";
  } else if (sexp instanceof SCons) {
    const rest = printListTail(sexp.cdr);
    if (rest === "") {
      return " " + sexpToStr(sexp.car);
    } else {
      return " " + sexpToStr(sexp.car) + rest;
    }
  } else {
    return " . " + sexpToStr(sexp);
  }
}

export function sexpToStr(sexp: SchemeType): string {
  if (sexp instanceof SchemeId) {
    return sexp.id;
  } else if (sexp instanceof SCons) {
    return "(" + sexpToStr(sexp.car) + printListTail(sexp.cdr) + ")";
  } else if (typeof sexp === "number") {
    return sexp.toString();
  } else if (typeof sexp === "string") {
    return `"${sexp}"`;
  } else if (typeof sexp === "boolean") {
    return sexp ? "#t" : "#f";
  } else if (sexp === null) {
    return "()";
  } else if (sexp instanceof SchemeClosure) {
    return "#<closure>";
  } else if (sexp instanceof SchemeBuiltin) {
    return "#<builtin>";
  } else {
    throw new Error(`Unexpected type B: ${typeof sexp}`);
  }
}

//
// Parser
//
export class SchemeParser {
  constructor(private lexer: Lexer) {}

  async parse(): Promise<SchemeType> {
    const token = await this.lexer.next();

    if (token.type === TokenType.Number) {
      return token.value;
    } else if (token.type === TokenType.String) {
      return token.value;
    } else if (token.type === TokenType.Boolean) {
      return token.value;
    } else if (token.type === TokenType.Identifier) {
      return new SchemeId(token.value);
    } else if (token.type === TokenType.LeftParen) {
      return this.parseList();
    } else if (token.type === TokenType.Quote) {
      return new SCons(
        new SchemeId("quote"),
        new SCons(await this.parse(), null),
      );
    } else {
      throw new Error(`Unexpected token: ${token.type}`);
    }
  }

  private async parseList(): Promise<SchemeType> {
    // Check if empty list ()
    const token = await this.lexer.peek();

    if (token.type === TokenType.RightParen) {
      await this.lexer.next(); // consume )
      return null;
    }

    // Parse first element (car)
    const car = await this.parse();

    // Parse rest of list (cdr)
    const cdr = await this.parseListTail();

    return new SCons(car, cdr);
  }

  private async parseListTail(): Promise<SchemeType> {
    const token = await this.lexer.peek();

    if (token.type === TokenType.RightParen) {
      // End of proper list - null terminated
      await this.lexer.next(); // consume )
      return null;
    }

    if (token.type === TokenType.Dot) {
      // Dotted pair - next element is the final cdr
      await this.lexer.next(); // consume dot
      const cdr = await this.parse();

      const closeParen = await this.lexer.next();
      if (closeParen.type !== TokenType.RightParen) {
        throw new Error(
          `Expected ')' after dotted pair, got ${closeParen.type}`,
        );
      }

      return cdr;
    }

    // More elements in the list
    const car = await this.parse();
    const cdr = await this.parseListTail();
    return new SCons(car, cdr);
  }
}

//
// Symbol table / Environment
//
export class Frame {
  private bindings: Map<string, SchemeType>;

  constructor(public parent: Frame | null) {
    this.parent = parent;
    this.bindings = new Map();
  }

  public findFrame(name: string): Frame | null {
    let currentFrame: Frame | null = this;

    while (currentFrame !== null) {
      if (currentFrame.bindings.has(name)) return currentFrame;
      currentFrame = currentFrame.parent;
    }

    return null;
  }

  public lookup(name: string): SchemeType | null {
    let frame = this.findFrame(name);
    if (frame !== null) return frame.bindings.get(name) as SchemeType;
    return null;
  }

  public set(name: string, value: SchemeType): void {
    this.bindings.set(name, value);
  }
}

//
// Scheme Analyzer
//
function carIsId(sexp: SchemeType, id: string): boolean {
  return (
    sexp instanceof SCons && sexp.car instanceof SchemeId && sexp.car.id === id
  );
}

export class SchemeAnalyzer {
  private macros = new Map<string, SchemeType>();

  private expandMacrosSexp(sexp: SchemeType): [SchemeType, boolean] {
    if (!(sexp instanceof SCons)) {
      return [sexp, false];
    }

    // Don't expand inside quoted forms
    if (sexp.car instanceof SchemeId && sexp.car.id === "quote") {
      return [sexp, false];
    }

    // Check if this is a macro invocation
    if (sexp.car instanceof SchemeId && this.macros.has(sexp.car.id)) {
      const transformer = this.macros.get(sexp.car.id)!;
      if (transformer instanceof SchemeClosure) {
        const args = sexp.cdr === null ? [] : [...(sexp.cdr as SCons)];
        return [transformer.eval(args), true];
      }
    }

    // Recursively expand car and cdr
    const [newCar, carChanged] = this.expandMacrosSexp(sexp.car);
    const [newCdr, cdrChanged] = this.expandMacrosSexp(sexp.cdr);
    if (carChanged || cdrChanged) {
      return [new SCons(newCar, newCdr), true];
    }
    return [sexp, false];
  }

  expandMacros(sexp: SchemeType): SchemeType {
    let current = sexp;
    while (true) {
      const [expanded, changed] = this.expandMacrosSexp(current);
      if (!changed) return current;
      console.log("macro expansion:", sexpToStr(expanded));
      current = expanded;
    }
  }

  analyzeSexp(sexp: SchemeType): (frame: Frame) => SchemeType {
    if (sexp instanceof SchemeId) {
      return (frame: Frame) => {
        if (frame.findFrame(sexp.id) === null)
          throw new Error(`Unbound variable: ${sexp.id}`);
        return frame.lookup(sexp.id);
      };
    } else if (
      typeof sexp === "number" ||
      typeof sexp === "string" ||
      typeof sexp === "boolean" ||
      sexp === null
    ) {
      return (frame: Frame) => sexp;
    } else if (sexp instanceof SCons) {
      if (carIsId(sexp, "quote")) {
        return (frame: Frame) => (sexp.cdr as SCons).car;
      } else if (carIsId(sexp, "lambda")) {
        return this.analyzeLambda(sexp.cdr as SCons);
      } else if (carIsId(sexp, "define")) {
        return this.analyzeDefine(sexp.cdr as SCons);
      } else if (carIsId(sexp, "or")) {
        return this.analyzeOr(sexp.cdr);
      } else if (carIsId(sexp, "and")) {
        return this.analyzeAnd(sexp.cdr);
      } else if (carIsId(sexp, "if")) {
        return this.analyzeIf(sexp.cdr as SCons);
      } else if (carIsId(sexp, "define-macro")) {
        return this.analyzeDefineMacro(sexp.cdr as SCons);
      } else {
        return this.analyzeApplication(sexp);
      }
    } else {
      console.log("Unexpected type A:", typeof sexp);
      throw new Error(`Unexpected type: ${typeof sexp}`);
    }
  }

  private analyzeDefine(sexp: SCons): (frame: Frame) => SchemeType {
    let id: string;
    let val: (frame: Frame) => SchemeType;
    if (sexp.car instanceof SCons) {
      // sexp is like ((funcname arg1 arg2) body)
      id = safeId(safeCar(sexp.car)).id;
      const lambdaSexp = new SCons(safeCdr(sexp.car), sexp.cdr);
      val = this.analyzeLambda(lambdaSexp);
    } else {
      id = safeId(sexp.car).id;
      val = this.analyzeSexp(safeCar(sexp.cdr));
    }
    return (frame: Frame) => {
      frame.set(id, val(frame));
      return new SchemeId(id);
    };
  }

  private analyzeDefineMacro(sexp: SCons): (frame: Frame) => SchemeType {
    // sexp is ((name args...) body...)
    const id = safeId(safeCar(sexp.car)).id;
    const lambdaSexp = new SCons(safeCdr(sexp.car), sexp.cdr);
    const val = this.analyzeLambda(lambdaSexp);
    return (frame: Frame) => {
      this.macros.set(id, val(frame));
      return new SchemeId(id);
    };
  }

  private analyzeApplication(sexp: SCons): (frame: Frame) => SchemeType {
    const operator = this.analyzeSexp(sexp.car);
    let operands: ((frame: Frame) => SchemeType)[] = [];

    if (sexp.cdr instanceof SCons) {
      operands = [...(sexp.cdr as SCons)].map((s) => this.analyzeSexp(s));
    }

    return (frame: Frame) => {
      const func = operator(frame);
      if (func instanceof SchemeBuiltin) {
        const args = operands.map((operand) => operand(frame));
        return func.eval(args);
      } else if (func instanceof SchemeClosure) {
        const args = operands.map((operand) => operand(frame));
        return func.eval(args);
      } else {
        throw new Error(`Not a function: ${func}`);
      }
    };
  }

  // Sexp is of the form (arg1 arg2 ... argn [ . rest ])
  private getLambdaArgs(sexpArgs: SCons): [string[], string | null] {
    let args = [];
    let rest = null;
    let sexp: SchemeType = sexpArgs;
    while (sexp != null) {
      if (sexp instanceof SCons) {
        args.push(safeId(sexp.car).id);
        sexp = sexp.cdr;
      } else {
        rest = safeId(sexp).id;
        break;
      }
    }
    return [args, rest];
  }

  // Assumes sexp is of the form ((arg1 arg2 ...) body)
  private analyzeLambda(sexp: SCons): (frame: Frame) => SchemeType {
    let [paramNames, restName] = this.getLambdaArgs(sexp.car as SCons);

    const body = sexp.cdr as SCons;

    // Assumes body is of the form (expr1 expr2 ...))
    const bodyFunc = this.analyzeBody(body);

    return (frame: Frame) => {
      const closure = new SchemeClosure(paramNames, restName, bodyFunc, frame);
      return closure;
    };
  }

  // sexp is of the form (expr1 expr2 ...)
  private analyzeOr(sexp: SchemeType): (frame: Frame) => SchemeType {
    if (sexp === null) {
      return () => false;
    }
    const forms = [...(sexp as SCons)].map((s) => this.analyzeSexp(s));
    return (frame: Frame) => {
      let result: SchemeType = false;
      for (const form of forms) {
        result = form(frame);
        if (result !== false) return result;
      }
      return result;
    };
  }

  private analyzeAnd(sexp: SchemeType): (frame: Frame) => SchemeType {
    if (sexp === null) {
      return () => true;
    }
    const forms = [...(sexp as SCons)].map((s) => this.analyzeSexp(s));
    return (frame: Frame) => {
      let result: SchemeType = true;
      for (const form of forms) {
        result = form(frame);
        if (result === false) return false;
      }
      return result;
    };
  }

  private analyzeIf(sexp: SCons): (frame: Frame) => SchemeType {
    const condition = this.analyzeSexp(sexp.car);
    const consequent = this.analyzeSexp(safeCar(sexp.cdr));
    const altSexp = safeCdr(sexp.cdr);
    const alternative =
      altSexp !== null ? this.analyzeBody(altSexp as SCons) : null;
    return (frame: Frame) => {
      if (condition(frame) !== false) {
        return consequent(frame);
      } else {
        return alternative !== null ? alternative(frame) : false;
      }
    };
  }

  private analyzeBody(sexp: SCons): (frame: Frame) => SchemeType {
    const bodySexps = [...sexp];

    const body = bodySexps.map((expr) => this.analyzeSexp(expr));

    return (frame: Frame) => {
      let result = null;
      for (const expr of body) {
        result = expr(frame);
      }
      return result;
    };
  }
}

//
// REPL
//
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

async function main(): Promise<void> {
  const input = new InputStream(process.stdin);
  const lexer = new Lexer(input);
  const parser = new SchemeParser(lexer);
  const env = initEnv();
  const analyzer = new SchemeAnalyzer();

  console.log("TSSCM.");

  try {
    while (true) {
      const token = await lexer.peek();
      if (token.type === TokenType.EOF) break;

      const result = await parser.parse();
      const expanded = analyzer.expandMacros(result);
      const analyzed = analyzer.analyzeSexp(expanded);
      console.log(sexpToStr(analyzed(env)));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
  } finally {
    lexer.close();
  }
}

// Only run main when this file is executed directly, not when imported
if (/main\.[tj]s$/.test(process.argv[1] ?? "")) {
  main();
}
