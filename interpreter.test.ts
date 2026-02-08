import assert from "assert";
import { InputStream, Lexer, TokenType } from "./lexer";
import { SchemeParser } from "./parser";
import { SchemeId, SCons, SchemeType, Frame } from "./types";
import { SchemeAnalyzer, sexpToStr } from "./analyzer";
import { initEnv } from "./builtins";

// Test utilities
async function evaluate(input: string, env?: Frame): Promise<SchemeType> {
  const stream = InputStream.fromString(input);
  const lexer = new Lexer(stream);
  const parser = new SchemeParser(lexer);
  const analyzer = new SchemeAnalyzer();
  const frame = env ?? initEnv();

  const result = await parser.parse();
  const expanded = analyzer.expandMacros(result);
  const analyzed = analyzer.analyzeSexp(expanded);
  const value = analyzed(frame);

  lexer.close();
  return value;
}

async function evaluateAll(
  input: string,
  env?: Frame,
): Promise<{ results: SchemeType[]; env: Frame }> {
  const stream = InputStream.fromString(input);
  const lexer = new Lexer(stream);
  const parser = new SchemeParser(lexer);
  const analyzer = new SchemeAnalyzer();
  const frame = env ?? initEnv();
  const results: SchemeType[] = [];

  while (true) {
    const token = await lexer.peek();
    if (token.type === TokenType.EOF) break;

    const result = await parser.parse();
    const expanded = analyzer.expandMacros(result);
    const analyzed = analyzer.analyzeSexp(expanded);
    results.push(analyzed(frame));
  }

  lexer.close();
  return { results, env: frame };
}

// Test runner
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.error(`  ${error}`);
    failed++;
  }
}

// ============================================
// Tests
// ============================================

async function runTests(): Promise<void> {
  console.log("=== Interpreter Tests ===\n");

  // --- Literals ---

  console.log("--- Literals ---");

  await test("evaluate number", async () => {
    const result = await evaluate("42");
    assert.strictEqual(result, 42);
  });

  await test("evaluate decimal", async () => {
    const result = await evaluate("3.14");
    assert.strictEqual(result, 3.14);
  });

  await test("evaluate negative number via subtraction", async () => {
    const result = await evaluate("(- 0 17)");
    assert.strictEqual(result, -17);
  });

  await test("evaluate string", async () => {
    const result = await evaluate('"hello"');
    assert.strictEqual(result, "hello");
  });

  await test("evaluate true", async () => {
    const result = await evaluate("#t");
    assert.strictEqual(result, true);
  });

  await test("evaluate false", async () => {
    const result = await evaluate("#f");
    assert.strictEqual(result, false);
  });

  await test("evaluate quoted symbol", async () => {
    const result = await evaluate("'foo");
    assert.ok(result instanceof SchemeId);
    assert.strictEqual((result as SchemeId).id, "foo");
  });

  await test("evaluate quoted list", async () => {
    const result = await evaluate("'(1 2 3)");
    assert.ok(result instanceof SCons);
    assert.strictEqual(sexpToStr(result), "(1 2 3)");
  });

  await test("evaluate empty list", async () => {
    const result = await evaluate("'()");
    assert.strictEqual(result, null);
  });

  // --- Arithmetic ---

  console.log("\n--- Arithmetic ---");

  await test("addition", async () => {
    const result = await evaluate("(+ 1 2 3)");
    assert.strictEqual(result, 6);
  });

  await test("subtraction", async () => {
    const result = await evaluate("(- 10 3 2)");
    assert.strictEqual(result, 5);
  });

  await test("multiplication", async () => {
    const result = await evaluate("(* 2 3 4)");
    assert.strictEqual(result, 24);
  });

  await test("division", async () => {
    const result = await evaluate("(/ 20 4 2)");
    assert.strictEqual(result, 2.5);
  });

  await test("nested arithmetic", async () => {
    const result = await evaluate("(+ (* 2 3) (- 10 5))");
    assert.strictEqual(result, 11);
  });

  await test("abs positive", async () => {
    const result = await evaluate("(abs 5)");
    assert.strictEqual(result, 5);
  });

  await test("abs negative", async () => {
    const result = await evaluate("(abs (- 0 7))");
    assert.strictEqual(result, 7);
  });

  await test("sqrt", async () => {
    const result = await evaluate("(sqrt 16)");
    assert.strictEqual(result, 4);
  });

  await test("sqrt decimal", async () => {
    const result = await evaluate("(sqrt 2)");
    assert.strictEqual(result, Math.sqrt(2));
  });

  await test("remainder positive", async () => {
    const result = await evaluate("(remainder 13 4)");
    assert.strictEqual(result, 1);
  });

  await test("remainder negative dividend", async () => {
    const result = await evaluate("(remainder (- 0 13) 4)");
    assert.strictEqual(result, -1);
  });

  await test("modulo positive", async () => {
    const result = await evaluate("(modulo 13 4)");
    assert.strictEqual(result, 1);
  });

  await test("modulo negative dividend", async () => {
    const result = await evaluate("(modulo (- 0 13) 4)");
    assert.strictEqual(result, 3);
  });

  // --- Comparison ---

  console.log("\n--- Comparison ---");

  await test("less than true", async () => {
    const result = await evaluate("(< 1 2 3)");
    assert.strictEqual(result, true);
  });

  await test("less than false", async () => {
    const result = await evaluate("(< 1 3 2)");
    assert.strictEqual(result, false);
  });

  await test("greater than true", async () => {
    const result = await evaluate("(> 3 2 1)");
    assert.strictEqual(result, true);
  });

  await test("greater than false", async () => {
    const result = await evaluate("(> 3 1 2)");
    assert.strictEqual(result, false);
  });

  // --- Boolean Operations ---

  console.log("\n--- Boolean Operations ---");

  await test("and all true", async () => {
    const result = await evaluate("(and #t #t #t)");
    assert.strictEqual(result, true);
  });

  await test("and short circuits", async () => {
    const result = await evaluate("(and #f (error))");
    assert.strictEqual(result, false);
  });

  await test("and returns last value", async () => {
    const result = await evaluate("(and 1 2 3)");
    assert.strictEqual(result, 3);
  });

  await test("and empty", async () => {
    const result = await evaluate("(and)");
    assert.strictEqual(result, true);
  });

  await test("or first true", async () => {
    const result = await evaluate("(or #t #f)");
    assert.strictEqual(result, true);
  });

  await test("or short circuits", async () => {
    const result = await evaluate("(or #t (error))");
    assert.strictEqual(result, true);
  });

  await test("or returns first truthy", async () => {
    const result = await evaluate("(or #f 42 #t)");
    assert.strictEqual(result, 42);
  });

  await test("or empty", async () => {
    const result = await evaluate("(or)");
    assert.strictEqual(result, false);
  });

  // --- Conditionals ---

  console.log("\n--- Conditionals ---");

  await test("if true branch", async () => {
    const result = await evaluate("(if #t 1 2)");
    assert.strictEqual(result, 1);
  });

  await test("if false branch", async () => {
    const result = await evaluate("(if #f 1 2)");
    assert.strictEqual(result, 2);
  });

  await test("if truthy value", async () => {
    const result = await evaluate("(if 42 1 2)");
    assert.strictEqual(result, 1);
  });

  await test("if without else", async () => {
    const result = await evaluate("(if #f 1)");
    assert.strictEqual(result, false);
  });

  await test("if with multiple expressions in else", async () => {
    const result = await evaluate("(if #f 1 2 3 4)");
    assert.strictEqual(result, 4);
  });

  // --- Define and Variables ---

  console.log("\n--- Define and Variables ---");

  await test("define and lookup variable", async () => {
    const { results } = await evaluateAll("(define x 42) x");
    assert.strictEqual(results[1], 42);
  });

  await test("define function shorthand", async () => {
    const { results } = await evaluateAll("(define (square x) (* x x)) (square 5)");
    assert.strictEqual(results[1], 25);
  });

  await test("define with expression", async () => {
    const { results } = await evaluateAll("(define y (+ 1 2)) y");
    assert.strictEqual(results[1], 3);
  });

  await test("unbound variable throws", async () => {
    await assert.rejects(async () => {
      await evaluate("undefined-var");
    }, /Unbound variable/);
  });

  await test("set! modifies variable", async () => {
    const { results } = await evaluateAll("(define x 1) (set! x 42) x");
    assert.strictEqual(results[2], 42);
  });

  await test("set! modifies variable in outer scope", async () => {
    const { results } = await evaluateAll(`
      (define x 1)
      (define (modify) (set! x 99))
      (modify)
      x
    `);
    assert.strictEqual(results[3], 99);
  });

  await test("set! unbound variable throws", async () => {
    await assert.rejects(async () => {
      await evaluate("(set! undefined-var 42)");
    }, /set!: Unbound variable/);
  });

  // --- Lambda ---

  console.log("\n--- Lambda ---");

  await test("lambda immediate call", async () => {
    const result = await evaluate("((lambda (x) (* x 2)) 5)");
    assert.strictEqual(result, 10);
  });

  await test("lambda multiple params", async () => {
    const result = await evaluate("((lambda (x y) (+ x y)) 3 4)");
    assert.strictEqual(result, 7);
  });

  await test("lambda closure", async () => {
    const { results } = await evaluateAll(`
      (define (make-adder n) (lambda (x) (+ x n)))
      (define add5 (make-adder 5))
      (add5 10)
    `);
    assert.strictEqual(results[2], 15);
  });

  await test("lambda rest parameter", async () => {
    const { results } = await evaluateAll(`
      (define (sum-all . nums) (apply + nums))
      (sum-all 1 2 3 4)
    `);
    assert.strictEqual(results[1], 10);
  });

  await test("lambda with body", async () => {
    const result = await evaluate("((lambda (x) (+ x 1) (* x 2)) 5)");
    assert.strictEqual(result, 10);
  });

  // --- List Operations ---

  console.log("\n--- List Operations ---");

  await test("cons", async () => {
    const result = await evaluate("(cons 1 '(2 3))");
    assert.strictEqual(sexpToStr(result), "(1 2 3)");
  });

  await test("cons pair", async () => {
    const result = await evaluate("(cons 1 2)");
    assert.strictEqual(sexpToStr(result), "(1 . 2)");
  });

  await test("car", async () => {
    const result = await evaluate("(car '(1 2 3))");
    assert.strictEqual(result, 1);
  });

  await test("cdr", async () => {
    const result = await evaluate("(cdr '(1 2 3))");
    assert.strictEqual(sexpToStr(result), "(2 3)");
  });

  await test("cdr of single element", async () => {
    const result = await evaluate("(cdr '(1))");
    assert.strictEqual(result, null);
  });

  await test("nested car/cdr", async () => {
    const result = await evaluate("(car (cdr '(1 2 3)))");
    assert.strictEqual(result, 2);
  });

  await test("apply", async () => {
    const result = await evaluate("(apply + '(1 2 3))");
    assert.strictEqual(result, 6);
  });

  // --- Type Predicates ---

  console.log("\n--- Type Predicates ---");

  await test("null? true", async () => {
    const result = await evaluate("(null? '())");
    assert.strictEqual(result, true);
  });

  await test("null? false", async () => {
    const result = await evaluate("(null? '(1))");
    assert.strictEqual(result, false);
  });

  await test("pair? true", async () => {
    const result = await evaluate("(pair? '(1 2))");
    assert.strictEqual(result, true);
  });

  await test("pair? false for null", async () => {
    const result = await evaluate("(pair? '())");
    assert.strictEqual(result, false);
  });

  await test("symbol? true", async () => {
    const result = await evaluate("(symbol? 'foo)");
    assert.strictEqual(result, true);
  });

  await test("symbol? false", async () => {
    const result = await evaluate("(symbol? 42)");
    assert.strictEqual(result, false);
  });

  // --- Equality ---

  console.log("\n--- Equality ---");

  await test("eq? same numbers", async () => {
    const result = await evaluate("(eq? 1 1)");
    assert.strictEqual(result, true);
  });

  await test("eq? different numbers", async () => {
    const result = await evaluate("(eq? 1 2)");
    assert.strictEqual(result, false);
  });

  await test("eq? same symbols", async () => {
    const result = await evaluate("(eq? 'a 'a)");
    assert.strictEqual(result, true);
  });

  await test("eq? different symbols", async () => {
    const result = await evaluate("(eq? 'a 'b)");
    assert.strictEqual(result, false);
  });

  await test("eq? booleans", async () => {
    const result = await evaluate("(eq? #t #t)");
    assert.strictEqual(result, true);
  });

  await test("eq? null", async () => {
    const result = await evaluate("(eq? '() '())");
    assert.strictEqual(result, true);
  });

  await test("eq? variadic", async () => {
    const result = await evaluate("(eq? 1 1 1 1)");
    assert.strictEqual(result, true);
  });

  await test("eqv? same numbers", async () => {
    const result = await evaluate("(eqv? 42 42)");
    assert.strictEqual(result, true);
  });

  await test("eqv? different numbers", async () => {
    const result = await evaluate("(eqv? 1 2)");
    assert.strictEqual(result, false);
  });

  await test("eqv? same symbols", async () => {
    const result = await evaluate("(eqv? 'foo 'foo)");
    assert.strictEqual(result, true);
  });

  await test("eqv? booleans", async () => {
    const result = await evaluate("(eqv? #f #f)");
    assert.strictEqual(result, true);
  });

  await test("eqv? mixed booleans", async () => {
    const result = await evaluate("(eqv? #t #f)");
    assert.strictEqual(result, false);
  });

  // --- Macros ---

  console.log("\n--- Macros ---");

  await test("simple macro", async () => {
    const { results } = await evaluateAll(`
      (define-macro (double x) (cons '+ (cons x (cons x '()))))
      (double 5)
    `);
    assert.strictEqual(results[1], 10);
  });

  await test("macro with multiple args", async () => {
    const { results } = await evaluateAll(`
      (define-macro (add3 a b c) (cons '+ (cons a (cons b (cons c '())))))
      (add3 1 2 3)
    `);
    assert.strictEqual(results[1], 6);
  });

  // --- Quasiquote ---

  console.log("\n--- Quasiquote ---");

  await test("quasiquote without unquote", async () => {
    const result = await evaluate("`(a b c)");
    assert.strictEqual(sexpToStr(result), "(a b c)");
  });

  await test("quasiquote with unquote", async () => {
    const { results } = await evaluateAll(`
      (define x 42)
      \`(a ,x c)
    `);
    assert.strictEqual(sexpToStr(results[1]), "(a 42 c)");
  });

  await test("quasiquote with unquote expression", async () => {
    const result = await evaluate("`(a ,(+ 1 2) c)");
    assert.strictEqual(sexpToStr(result), "(a 3 c)");
  });

  await test("quasiquote with unquote-splicing", async () => {
    const { results } = await evaluateAll(`
      (define xs '(1 2 3))
      \`(a ,@xs b)
    `);
    assert.strictEqual(sexpToStr(results[1]), "(a 1 2 3 b)");
  });

  await test("quasiquote with unquote-splicing empty list", async () => {
    const { results } = await evaluateAll(`
      (define xs '())
      \`(a ,@xs b)
    `);
    assert.strictEqual(sexpToStr(results[1]), "(a b)");
  });

  await test("quasiquote nested list", async () => {
    const { results } = await evaluateAll(`
      (define x 2)
      \`((a ,x) (b ,(+ x 1)))
    `);
    assert.strictEqual(sexpToStr(results[1]), "((a 2) (b 3))");
  });

  await test("quasiquote atom", async () => {
    const result = await evaluate("`42");
    assert.strictEqual(result, 42);
  });

  await test("quasiquote symbol", async () => {
    const result = await evaluate("`foo");
    assert.ok(result instanceof SchemeId);
    assert.strictEqual((result as SchemeId).id, "foo");
  });

  await test("quasiquote with multiple unquotes", async () => {
    const { results } = await evaluateAll(`
      (define a 1)
      (define b 2)
      \`(,a ,b ,a)
    `);
    assert.strictEqual(sexpToStr(results[2]), "(1 2 1)");
  });

  await test("quasiquote with unquote-splicing at end", async () => {
    const { results } = await evaluateAll(`
      (define xs '(2 3))
      \`(1 ,@xs)
    `);
    assert.strictEqual(sexpToStr(results[1]), "(1 2 3)");
  });

  await test("quasiquote with unquote-splicing at start", async () => {
    const { results } = await evaluateAll(`
      (define xs '(1 2))
      \`(,@xs 3)
    `);
    assert.strictEqual(sexpToStr(results[1]), "(1 2 3)");
  });

  // --- Recursion ---

  console.log("\n--- Recursion ---");

  await test("factorial", async () => {
    const { results } = await evaluateAll(`
      (define (factorial n)
        (if (< n 2)
            1
            (* n (factorial (- n 1)))))
      (factorial 5)
    `);
    assert.strictEqual(results[1], 120);
  });

  await test("fibonacci", async () => {
    const { results } = await evaluateAll(`
      (define (fib n)
        (if (< n 2)
            n
            (+ (fib (- n 1)) (fib (- n 2)))))
      (fib 10)
    `);
    assert.strictEqual(results[1], 55);
  });

  // --- Print Summary ---

  console.log("\n===================");
  console.log(`Total: ${passed + failed} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
