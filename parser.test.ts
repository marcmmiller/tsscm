import assert from "assert";
import { InputStream, Lexer } from "./lexer";
import { SchemeParser } from "./parser";
import { SchemeId, SCons, SchemeType } from "./types";

// Test utilities
async function parse(input: string): Promise<SchemeType> {
  const stream = InputStream.fromString(input);
  const lexer = new Lexer(stream);
  const parser = new SchemeParser(lexer);
  const result = await parser.parse();
  lexer.close();
  return result;
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
  console.log("=== Parser Tests ===\n");

  // --- Atoms ---

  console.log("--- Atoms ---");

  await test("parse number", async () => {
    const result = await parse("42");
    assert.strictEqual(result, 42);
  });

  await test("parse decimal number", async () => {
    const result = await parse("3.14");
    assert.strictEqual(result, 3.14);
  });

  await test("parse identifier", async () => {
    const result = await parse("foo");
    assert.ok(result instanceof SchemeId);
    assert.strictEqual((result as SchemeId).id, "foo");
  });

  await test("parse operator identifier", async () => {
    const result = await parse("+");
    assert.ok(result instanceof SchemeId);
    assert.strictEqual((result as SchemeId).id, "+");
  });

  // --- Lists ---

  console.log("\n--- Lists ---");

  await test("parse empty list", async () => {
    const result = await parse("()");
    assert.strictEqual(result, null);
  });

  await test("parse simple dotted pair", async () => {
    // (a . b) => SCons(SchemeId("a"), SchemeId("b"))
    const result = await parse("(a . b)");
    assert.ok(result instanceof SCons);
    const cons = result as SCons;
    assert.ok(cons.car instanceof SchemeId);
    assert.strictEqual((cons.car as SchemeId).id, "a");
    assert.ok(cons.cdr instanceof SchemeId);
    assert.strictEqual((cons.cdr as SchemeId).id, "b");
  });

  await test("parse dotted pair with numbers", async () => {
    // (1 . 2) => SCons(1, 2)
    const result = await parse("(1 . 2)");
    assert.ok(result instanceof SCons);
    const cons = result as SCons;
    assert.strictEqual(cons.car, 1);
    assert.strictEqual(cons.cdr, 2);
  });

  await test("parse list ending with dot", async () => {
    // (4 5 . 6) => SCons(4, SCons(5, 6))
    const result = await parse("(4 5 . 6)");
    assert.ok(result instanceof SCons);
    const cons1 = result as SCons;
    assert.strictEqual(cons1.car, 4);
    assert.ok(cons1.cdr instanceof SCons);
    const cons2 = cons1.cdr as SCons;
    assert.strictEqual(cons2.car, 5);
    assert.strictEqual(cons2.cdr, 6);
  });

  await test("parse proper list (null terminated)", async () => {
    // (5 6 7) => SCons(5, SCons(6, SCons(7, null)))
    const result = await parse("(5 6 7)");
    assert.ok(result instanceof SCons);
    const cons1 = result as SCons;
    assert.strictEqual(cons1.car, 5);
    assert.ok(cons1.cdr instanceof SCons);
    const cons2 = cons1.cdr as SCons;
    assert.strictEqual(cons2.car, 6);
    assert.ok(cons2.cdr instanceof SCons);
    const cons3 = cons2.cdr as SCons;
    assert.strictEqual(cons3.car, 7);
    assert.strictEqual(cons3.cdr, null);
  });

  await test("parse single element list", async () => {
    // (x) => SCons(SchemeId("x"), null)
    const result = await parse("(x)");
    assert.ok(result instanceof SCons);
    const cons = result as SCons;
    assert.ok(cons.car instanceof SchemeId);
    assert.strictEqual((cons.car as SchemeId).id, "x");
    assert.strictEqual(cons.cdr, null);
  });

  await test("parse nested list", async () => {
    // ((a b) c) => SCons(SCons(a, SCons(b, null)), SCons(c, null))
    const result = await parse("((a b) c)");
    assert.ok(result instanceof SCons);
    const outer = result as SCons;

    // First element is (a b)
    assert.ok(outer.car instanceof SCons);
    const inner = outer.car as SCons;
    assert.ok(inner.car instanceof SchemeId);
    assert.strictEqual((inner.car as SchemeId).id, "a");
    assert.ok(inner.cdr instanceof SCons);
    const innerCdr = inner.cdr as SCons;
    assert.ok(innerCdr.car instanceof SchemeId);
    assert.strictEqual((innerCdr.car as SchemeId).id, "b");
    assert.strictEqual(innerCdr.cdr, null);

    // Second element is c
    assert.ok(outer.cdr instanceof SCons);
    const outerCdr = outer.cdr as SCons;
    assert.ok(outerCdr.car instanceof SchemeId);
    assert.strictEqual((outerCdr.car as SchemeId).id, "c");
    assert.strictEqual(outerCdr.cdr, null);
  });

  await test("parse s-expression (+ 1 2)", async () => {
    const result = await parse("(+ 1 2)");
    assert.ok(result instanceof SCons);
    const cons1 = result as SCons;
    assert.ok(cons1.car instanceof SchemeId);
    assert.strictEqual((cons1.car as SchemeId).id, "+");
    assert.ok(cons1.cdr instanceof SCons);
    const cons2 = cons1.cdr as SCons;
    assert.strictEqual(cons2.car, 1);
    assert.ok(cons2.cdr instanceof SCons);
    const cons3 = cons2.cdr as SCons;
    assert.strictEqual(cons3.car, 2);
    assert.strictEqual(cons3.cdr, null);
  });

  await test("parse define expression", async () => {
    // (define x 42) => SCons(define, SCons(x, SCons(42, null)))
    const result = await parse("(define x 42)");
    assert.ok(result instanceof SCons);
    const cons1 = result as SCons;
    assert.ok(cons1.car instanceof SchemeId);
    assert.strictEqual((cons1.car as SchemeId).id, "define");
    assert.ok(cons1.cdr instanceof SCons);
    const cons2 = cons1.cdr as SCons;
    assert.ok(cons2.car instanceof SchemeId);
    assert.strictEqual((cons2.car as SchemeId).id, "x");
    assert.ok(cons2.cdr instanceof SCons);
    const cons3 = cons2.cdr as SCons;
    assert.strictEqual(cons3.car, 42);
    assert.strictEqual(cons3.cdr, null);
  });

  // --- Error Handling ---

  console.log("\n--- Error Handling ---");

  await test("parser error on missing close paren after dot", async () => {
    try {
      await parse("(a . b c)");
      assert.fail("Expected an error to be thrown");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("Expected ')'"));
    }
  });

  // --- Summary ---

  console.log("\n=== Summary ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
