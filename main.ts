import { createReadStream, existsSync } from "fs";
import { resolve } from "path";
import { TokenType, InputStream, Lexer } from "./lexer";
import { SchemeParser } from "./parser";
import { Frame } from "./types";
import { SchemeAnalyzer, sexpToStr } from "./analyzer";
import { initEnv } from "./builtins";

export async function repl(
  env: Frame,
  analyzer: SchemeAnalyzer,
  input: InputStream,
  print: boolean = true
): Promise<void> {
  const lexer = new Lexer(input);
  const parser = new SchemeParser(lexer);

  try {
    while (true) {
      const token = await lexer.peek();
      if (token.type === TokenType.EOF) break;

      const parsed = await parser.parse();
      const expanded = analyzer.expandMacros(parsed, env);
      const analyzed = analyzer.analyzeSexp(expanded);
      const result = analyzed(env);
      if (print) {
        console.log(sexpToStr(result));
      }
    }
  } finally {
    lexer.close();
  }
}

async function main(): Promise<void> {
  const env = initEnv();
  const analyzer = new SchemeAnalyzer();

  try {
    const libPath = resolve(__dirname, "lib.scm");
    if (existsSync(libPath)) {
      await repl(
        env,
        analyzer,
        new InputStream(createReadStream(libPath)),
        false  // suppress printing
      );
    } else {
      console.log("lib.scm is not available.")
    }
    await repl(env, analyzer, new InputStream(process.stdin));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
  }
}

main();
