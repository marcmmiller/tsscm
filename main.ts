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
): Promise<void> {
  const lexer = new Lexer(input);
  const parser = new SchemeParser(lexer);

  try {
    while (true) {
      const token = await lexer.peek();
      if (token.type === TokenType.EOF) break;

      const result = await parser.parse();
      const expanded = analyzer.expandMacros(result);
      const analyzed = analyzer.analyzeSexp(expanded);
      console.log(sexpToStr(analyzed(env)));
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
