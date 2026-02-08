import {
  SchemeId,
  SCons,
  Frame,
  SchemeBuiltin,
  SchemeClosure,
  SchemeType,
} from "./types";

//
// Helper functions
//
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

function carIsId(sexp: SchemeType, id: string): boolean {
  return (
    sexp instanceof SCons && sexp.car instanceof SchemeId && sexp.car.id === id
  );
}

//
// S-expression printing
//
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
// Scheme Analyzer
//
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
      } else if (carIsId(sexp, "quasiquote")) {
        return this.analyzeQuasiquote((sexp.cdr as SCons).car);
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

  private analyzeQuasiquote(sexp: SchemeType): (frame: Frame) => SchemeType {
    // Atoms are returned as-is (like quote)
    if (!(sexp instanceof SCons)) {
      return () => sexp;
    }

    // (unquote expr) - evaluate expr
    if (carIsId(sexp, "unquote")) {
      return this.analyzeSexp(safeCar(sexp.cdr));
    }

    // (unquote-splicing expr) at top level is an error
    if (carIsId(sexp, "unquote-splicing")) {
      throw new Error("unquote-splicing: not valid at top level of quasiquote");
    }

    // It's a list - process each element, handling unquote-splicing
    const elements: Array<{
      isSplice: boolean;
      func: (frame: Frame) => SchemeType;
    }> = [];

    let current: SchemeType = sexp;
    while (current instanceof SCons) {
      const elem = current.car;

      if (carIsId(elem, "unquote-splicing")) {
        // This element should be spliced
        elements.push({
          isSplice: true,
          func: this.analyzeSexp(safeCar((elem as SCons).cdr)),
        });
      } else {
        // Regular element - recursively process with quasiquote
        elements.push({
          isSplice: false,
          func: this.analyzeQuasiquote(elem),
        });
      }

      current = current.cdr;
    }

    // Handle improper lists (dotted pairs)
    const tailFunc = current !== null ? this.analyzeQuasiquote(current) : null;

    return (frame: Frame) => {
      // Collect all result elements, splicing where needed
      const resultElements: SchemeType[] = [];

      for (const { isSplice, func } of elements) {
        const value = func(frame);
        if (isSplice) {
          // Splice the list elements
          if (value !== null && !(value instanceof SCons)) {
            throw new Error("unquote-splicing: expected a list");
          }
          let list = value as SCons | null;
          while (list !== null) {
            resultElements.push(list.car);
            list = list.cdr as SCons | null;
          }
        } else {
          resultElements.push(value);
        }
      }

      // Build the cons list from the elements (right to left)
      let result: SchemeType = tailFunc ? tailFunc(frame) : null;
      for (let i = resultElements.length - 1; i >= 0; i--) {
        result = new SCons(resultElements[i], result);
      }

      return result;
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
