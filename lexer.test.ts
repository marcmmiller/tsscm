import assert from "assert";
import { TokenType, Token, InputStream, Lexer } from "./main";

// Test utilities
async function tokenize(input: string): Promise<Token[]> {
  const stream = InputStream.fromString(input);
  const lexer = new Lexer(stream);
  const tokens: Token[] = [];

  while (true) {
    const token = await lexer.next();
    tokens.push(token);
    if (token.type === TokenType.EOF) break;
  }

  lexer.close();
  return tokens;
}

function assertTokenEquals(
  actual: Token,
  expected: Token,
  message?: string,
): void {
  assert.strictEqual(actual.type, expected.type, message);
  if ("value" in expected) {
    assert.strictEqual(
      (actual as { value: unknown }).value,
      expected.value,
      message,
    );
  }
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
  console.log("=== Lexer Tests ===\n");

  // --- Number Tests ---

  console.log("--- Numbers ---");

  await test("integer number", async () => {
    const tokens = await tokenize("42");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 42 });
    assertTokenEquals(tokens[1], { type: TokenType.EOF });
  });

  await test("decimal number", async () => {
    const tokens = await tokenize("3.14");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 3.14 });
  });

  await test("number starting with decimal point", async () => {
    const tokens = await tokenize(".5");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 0.5 });
  });

  await test("multiple numbers", async () => {
    const tokens = await tokenize("1 2 3");
    assert.strictEqual(tokens.length, 4);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 1 });
    assertTokenEquals(tokens[1], { type: TokenType.Number, value: 2 });
    assertTokenEquals(tokens[2], { type: TokenType.Number, value: 3 });
  });

  await test("number with trailing decimal", async () => {
    const tokens = await tokenize("5.");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 5 });
  });

  await test("zero", async () => {
    const tokens = await tokenize("0");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 0 });
  });

  await test("large number", async () => {
    const tokens = await tokenize("123456789");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 123456789 });
  });

  await test("small decimal", async () => {
    const tokens = await tokenize("0.001");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 0.001 });
  });

  // --- Identifier Tests ---

  console.log("\n--- Identifiers ---");

  await test("simple identifier", async () => {
    const tokens = await tokenize("foo");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "foo" });
  });

  await test("identifier with underscore", async () => {
    const tokens = await tokenize("foo_bar");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], {
      type: TokenType.Identifier,
      value: "foo_bar",
    });
  });

  await test("identifier starting with underscore", async () => {
    const tokens = await tokenize("_private");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], {
      type: TokenType.Identifier,
      value: "_private",
    });
  });

  await test("identifier with digits", async () => {
    const tokens = await tokenize("var1");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "var1" });
  });

  await test("identifier with plus", async () => {
    const tokens = await tokenize("+");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "+" });
  });

  await test("identifier with minus", async () => {
    const tokens = await tokenize("-");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "-" });
  });

  await test("identifier with asterisk", async () => {
    const tokens = await tokenize("*");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "*" });
  });

  await test("identifier with slash", async () => {
    const tokens = await tokenize("/");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "/" });
  });

  await test("identifier with less-than", async () => {
    const tokens = await tokenize("<");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "<" });
  });

  await test("identifier with greater-than", async () => {
    const tokens = await tokenize(">");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: ">" });
  });

  await test("identifier with equals", async () => {
    const tokens = await tokenize("=");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "=" });
  });

  await test("equality operator identifier", async () => {
    const tokens = await tokenize("==");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "==" });
  });

  await test("spaceship operator identifier", async () => {
    const tokens = await tokenize("<=>");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "<=>" });
  });

  await test("arrow-style identifier", async () => {
    const tokens = await tokenize("list->map");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], {
      type: TokenType.Identifier,
      value: "list->map",
    });
  });

  await test("bidirectional arrow identifier", async () => {
    const tokens = await tokenize("<->");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "<->" });
  });

  await test("complex identifier with operators", async () => {
    const tokens = await tokenize("a+b*c");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], {
      type: TokenType.Identifier,
      value: "a+b*c",
    });
  });

  await test("uppercase identifier", async () => {
    const tokens = await tokenize("FOO");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "FOO" });
  });

  await test("mixed case identifier", async () => {
    const tokens = await tokenize("camelCase");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], {
      type: TokenType.Identifier,
      value: "camelCase",
    });
  });

  // --- Dot Tests ---

  console.log("\n--- Dots ---");

  await test("standalone dot", async () => {
    const tokens = await tokenize(".");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Dot });
  });

  await test("dot between identifiers (dotted pair)", async () => {
    const tokens = await tokenize("a . b");
    assert.strictEqual(tokens.length, 4);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "a" });
    assertTokenEquals(tokens[1], { type: TokenType.Dot });
    assertTokenEquals(tokens[2], { type: TokenType.Identifier, value: "b" });
  });

  await test("dot followed by letter is dot then identifier", async () => {
    const tokens = await tokenize(".x");
    assert.strictEqual(tokens.length, 3);
    assertTokenEquals(tokens[0], { type: TokenType.Dot });
    assertTokenEquals(tokens[1], { type: TokenType.Identifier, value: "x" });
  });

  await test("dot followed by digit is number", async () => {
    const tokens = await tokenize(".123");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 0.123 });
  });

  // --- Parentheses Tests ---

  console.log("\n--- Parentheses ---");

  await test("left parenthesis", async () => {
    const tokens = await tokenize("(");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
  });

  await test("right parenthesis", async () => {
    const tokens = await tokenize(")");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.RightParen });
  });

  await test("matched parentheses", async () => {
    const tokens = await tokenize("()");
    assert.strictEqual(tokens.length, 3);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], { type: TokenType.RightParen });
  });

  await test("nested parentheses", async () => {
    const tokens = await tokenize("(())");
    assert.strictEqual(tokens.length, 5);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[2], { type: TokenType.RightParen });
    assertTokenEquals(tokens[3], { type: TokenType.RightParen });
  });

  // --- Whitespace Tests ---

  console.log("\n--- Whitespace ---");

  await test("leading whitespace", async () => {
    const tokens = await tokenize("   42");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 42 });
  });

  await test("trailing whitespace", async () => {
    const tokens = await tokenize("42   ");
    assert.strictEqual(tokens.length, 2);
    assertTokenEquals(tokens[0], { type: TokenType.Number, value: 42 });
  });

  await test("newlines as whitespace", async () => {
    const tokens = await tokenize("a\nb\nc");
    assert.strictEqual(tokens.length, 4);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "a" });
    assertTokenEquals(tokens[1], { type: TokenType.Identifier, value: "b" });
    assertTokenEquals(tokens[2], { type: TokenType.Identifier, value: "c" });
  });

  await test("tabs as whitespace", async () => {
    const tokens = await tokenize("a\tb");
    assert.strictEqual(tokens.length, 3);
    assertTokenEquals(tokens[0], { type: TokenType.Identifier, value: "a" });
    assertTokenEquals(tokens[1], { type: TokenType.Identifier, value: "b" });
  });

  await test("empty input", async () => {
    const tokens = await tokenize("");
    assert.strictEqual(tokens.length, 1);
    assertTokenEquals(tokens[0], { type: TokenType.EOF });
  });

  await test("only whitespace", async () => {
    const tokens = await tokenize("   \t\n   ");
    assert.strictEqual(tokens.length, 1);
    assertTokenEquals(tokens[0], { type: TokenType.EOF });
  });

  // --- Complex Expressions ---

  console.log("\n--- Complex Expressions ---");

  await test("simple s-expression", async () => {
    const tokens = await tokenize("(+ 1 2)");
    assert.strictEqual(tokens.length, 6);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], { type: TokenType.Identifier, value: "+" });
    assertTokenEquals(tokens[2], { type: TokenType.Number, value: 1 });
    assertTokenEquals(tokens[3], { type: TokenType.Number, value: 2 });
    assertTokenEquals(tokens[4], { type: TokenType.RightParen });
  });

  await test("nested s-expression", async () => {
    const tokens = await tokenize("(* (+ 1 2) 3)");
    assert.strictEqual(tokens.length, 10);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], { type: TokenType.Identifier, value: "*" });
    assertTokenEquals(tokens[2], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[3], { type: TokenType.Identifier, value: "+" });
    assertTokenEquals(tokens[4], { type: TokenType.Number, value: 1 });
    assertTokenEquals(tokens[5], { type: TokenType.Number, value: 2 });
    assertTokenEquals(tokens[6], { type: TokenType.RightParen });
    assertTokenEquals(tokens[7], { type: TokenType.Number, value: 3 });
    assertTokenEquals(tokens[8], { type: TokenType.RightParen });
  });

  await test("dotted pair", async () => {
    const tokens = await tokenize("(a . b)");
    assert.strictEqual(tokens.length, 6);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], { type: TokenType.Identifier, value: "a" });
    assertTokenEquals(tokens[2], { type: TokenType.Dot });
    assertTokenEquals(tokens[3], { type: TokenType.Identifier, value: "b" });
    assertTokenEquals(tokens[4], { type: TokenType.RightParen });
  });

  await test("define expression", async () => {
    const tokens = await tokenize("(define foo 42)");
    assert.strictEqual(tokens.length, 6);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], {
      type: TokenType.Identifier,
      value: "define",
    });
    assertTokenEquals(tokens[2], { type: TokenType.Identifier, value: "foo" });
    assertTokenEquals(tokens[3], { type: TokenType.Number, value: 42 });
    assertTokenEquals(tokens[4], { type: TokenType.RightParen });
  });

  await test("lambda expression", async () => {
    const tokens = await tokenize("(lambda (x) (* x x))");
    assert.strictEqual(tokens.length, 12);
    assertTokenEquals(tokens[0], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[1], {
      type: TokenType.Identifier,
      value: "lambda",
    });
    assertTokenEquals(tokens[2], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[3], { type: TokenType.Identifier, value: "x" });
    assertTokenEquals(tokens[4], { type: TokenType.RightParen });
    assertTokenEquals(tokens[5], { type: TokenType.LeftParen });
    assertTokenEquals(tokens[6], { type: TokenType.Identifier, value: "*" });
    assertTokenEquals(tokens[7], { type: TokenType.Identifier, value: "x" });
    assertTokenEquals(tokens[8], { type: TokenType.Identifier, value: "x" });
    assertTokenEquals(tokens[9], { type: TokenType.RightParen });
    assertTokenEquals(tokens[10], { type: TokenType.RightParen });
  });

  // --- Peek Tests ---

  console.log("\n--- Peek Behavior ---");

  await test("peek does not consume token", async () => {
    const stream = InputStream.fromString("42");
    const lexer = new Lexer(stream);

    const peeked1 = await lexer.peek();
    const peeked2 = await lexer.peek();
    const consumed = await lexer.next();

    assertTokenEquals(peeked1, { type: TokenType.Number, value: 42 });
    assertTokenEquals(peeked2, { type: TokenType.Number, value: 42 });
    assertTokenEquals(consumed, { type: TokenType.Number, value: 42 });

    const eof = await lexer.next();
    assertTokenEquals(eof, { type: TokenType.EOF });

    lexer.close();
  });

  // --- Error Tests ---

  console.log("\n--- Error Handling ---");

  await test("unexpected character throws error", async () => {
    try {
      await tokenize("@");
      assert.fail("Expected an error to be thrown");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("Unexpected character"));
    }
  });

  await test("double decimal point throws error", async () => {
    try {
      await tokenize("1.2.3");
      assert.fail("Expected an error to be thrown");
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("decimal point"));
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
