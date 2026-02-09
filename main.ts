import { createReadStream, existsSync } from "fs";
import { resolve } from "path";
import { TokenType, InputStream, Lexer } from "./lexer";
import { SchemeParser } from "./parser";
import { SchemeType, SchemeId, Frame } from "./types";
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
      const loadNext = env.lookup("*load-next*");
      if (loadNext !== false) {
        env.set("*load-next*", false);
        loadSexp(loadNext, env, analyzer);
      }
      if (print) {
        console.log(sexpToStr(result));
      }
    }
  } finally {
    lexer.close();
  }
}

async function loadSexp(path: SchemeType, env: Frame, analyzer: SchemeAnalyzer): Promise<void> {
  let pathStr: string;
  if (path instanceof SchemeId) {
    pathStr = path.id + ".scm";
  } else if (typeof(path) === "string") {
    pathStr = path
  } else {
    throw new Error("Incorrect type for path: " + sexpToStr(path));
  }
  return await load(resolve(__dirname, pathStr), env, analyzer);
}

async function load(libPath: string, env: Frame, analyzer: SchemeAnalyzer): Promise<void> {
  console.log("loading ", libPath);
  if (existsSync(libPath)) {
    await repl(
      env,
      analyzer,
      new InputStream(createReadStream(libPath)),
      false  // suppress printing
    );
  } else {
    console.log(libPath + ": file not found.")
  }
}

async function main(): Promise<void> {
  const env = initEnv();
  const analyzer = new SchemeAnalyzer();

  try {
    await load(resolve(__dirname, "lib.scm"), env, analyzer);
    await repl(env, analyzer, new InputStream(process.stdin));
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
  }
}

main();
