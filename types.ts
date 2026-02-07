//
// Scheme Type System
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
// Runtime types
//
export class SchemeBuiltin {
  constructor(public func: (args: SchemeType[]) => SchemeType) {}
  public eval(args: SchemeType[]): SchemeType {
    return this.func(args);
  }
}

export class SchemeClosure {
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
      const restList = restArgs.reverse().reduce(
        (accumulator, current) => {
          return new SCons(current, accumulator);
        },
        null as SchemeType,
      );
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
