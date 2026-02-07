import { Readable } from "stream";

// Token types
export enum TokenType {
  Number = "Number",
  String = "String",
  Boolean = "Boolean",
  Identifier = "Identifier",
  LeftParen = "LeftParen",
  RightParen = "RightParen",
  Quote = "Quote",
  Dot = "Dot",
  EOF = "EOF",
}

export type Token =
  | { type: TokenType.Number; value: number }
  | { type: TokenType.String; value: string }
  | { type: TokenType.Boolean; value: boolean }
  | { type: TokenType.Identifier; value: string }
  | { type: TokenType.LeftParen }
  | { type: TokenType.RightParen }
  | { type: TokenType.Quote }
  | { type: TokenType.Dot }
  | { type: TokenType.EOF };

// Character input stream that reads from any ReadableStream
export class InputStream {
  private buffer: string = "";
  private pos: number = 0;
  private input: Readable;
  private pendingResolve: ((value: string | null) => void) | null = null;
  private eof: boolean = false;

  constructor(input: Readable = process.stdin) {
    this.input = input;

    input.setEncoding("utf8");

    input.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.tryResolve();
    });

    input.on("end", () => {
      this.eof = true;
      this.tryResolve();
    });

    input.on("error", () => {
      this.eof = true;
      this.tryResolve();
    });
  }

  private tryResolve(): void {
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;

      if (this.pos < this.buffer.length) {
        resolve(this.buffer[this.pos++]);
      } else if (this.eof) {
        resolve(null);
      } else {
        // Re-register the pending resolve if we still don't have data
        this.pendingResolve = resolve;
      }
    }
  }

  async nextChar(): Promise<string | null> {
    // If we have characters in the buffer, return the next one
    if (this.pos < this.buffer.length) {
      return this.buffer[this.pos++];
    }

    // If EOF, return null
    if (this.eof) {
      return null;
    }

    // Wait for more input
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  close(): void {
    this.input.destroy();
  }

  // Factory method to create an InputStream from a string
  static fromString(str: string): InputStream {
    return new InputStream(Readable.from(str));
  }
}

//
// Lexer that produces tokens from the input stream
//
export class Lexer {
  private input: InputStream;
  private currentChar: string | null = null;
  private peekedToken: Token | null = null;
  private initialized: boolean = false;

  constructor(input: InputStream) {
    this.input = input;
  }

  private async advance(): Promise<void> {
    this.currentChar = await this.input.nextChar();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.advance();
      this.initialized = true;
    }
  }

  private async skipWhitespace(): Promise<void> {
    while (this.currentChar !== null) {
      if (/\s/.test(this.currentChar)) {
        await this.advance();
      } else if (this.currentChar === ";") {
        do {
          await this.advance();
        } while (
          this.currentChar !== null &&
          (this.currentChar as string) !== "\n"
        );
      } else {
        break;
      }
    }
  }

  private async readNumber(prefix: string = ""): Promise<Token> {
    let numStr = prefix;
    let hasDecimal = prefix === ".";

    while (this.currentChar !== null && /[0-9.]/.test(this.currentChar)) {
      if (this.currentChar === ".") {
        if (hasDecimal) {
          // Second decimal point is an error
          throw new Error(
            `Invalid number: "${numStr}." - unexpected second decimal point`,
          );
        }
        hasDecimal = true;
      }
      numStr += this.currentChar;
      await this.advance();
    }

    return { type: TokenType.Number, value: parseFloat(numStr) };
  }

  private async readIdentifier(): Promise<Token> {
    let identifier = "";

    // Identifier can contain: letters, digits, underscore, math operators (+, -, *, /), comparisons (<, >), and equals (=)
    while (
      this.currentChar !== null &&
      /[a-zA-Z0-9_+\-*/<>=?]/.test(this.currentChar)
    ) {
      identifier += this.currentChar;
      await this.advance();
    }

    return { type: TokenType.Identifier, value: identifier };
  }

  private async readString(): Promise<Token> {
    let str = "";

    while (this.currentChar !== null && this.currentChar !== '"') {
      if (this.currentChar === "\\") {
        await this.advance();
        if (this.currentChar === null) {
          throw new Error("Unexpected end of input in string escape sequence");
        }
        const escaped: string = this.currentChar;
        switch (escaped) {
          case "n":
            str += "\n";
            break;
          case "t":
            str += "\t";
            break;
          case "r":
            str += "\r";
            break;
          case "\\":
            str += "\\";
            break;
          case '"':
            str += '"';
            break;
          case "0":
            str += "\0";
            break;
          case "b":
            str += "\b";
            break;
          case "f":
            str += "\f";
            break;
          case "v":
            str += "\v";
            break;
          default:
            throw new Error(`Unknown escape sequence: \\${this.currentChar}`);
        }
      } else {
        str += this.currentChar;
      }
      await this.advance();
    }

    if (this.currentChar === null) {
      throw new Error("Unterminated string literal");
    }

    await this.advance(); // consume closing "
    return { type: TokenType.String, value: str };
  }

  private async readNextToken(): Promise<Token> {
    await this.ensureInitialized();
    await this.skipWhitespace();

    if (this.currentChar === null) {
      return { type: TokenType.EOF };
    }

    // Numbers (start with digit only; dots handled separately)
    if (/[0-9]/.test(this.currentChar)) {
      return this.readNumber();
    }

    // Identifiers (can start with letter, underscore, math operator, comparison, or equals)
    if (/[a-zA-Z_+\-*/<>=?]/.test(this.currentChar)) {
      return this.readIdentifier();
    }

    // Other single-character tokens
    const char = this.currentChar;
    await this.advance();

    switch (char) {
      case "(":
        return { type: TokenType.LeftParen };
      case ")":
        return { type: TokenType.RightParen };
      case ".":
        // Check if this is a decimal number like .5
        if (this.currentChar !== null && /[0-9]/.test(this.currentChar)) {
          return this.readNumber(".");
        }
        return { type: TokenType.Dot };
      case "'":
        return { type: TokenType.Quote };
      case '"':
        return this.readString();
      case "#":
        if (this.currentChar === "t") {
          await this.advance();
          return { type: TokenType.Boolean, value: true };
        } else if (this.currentChar === "f") {
          await this.advance();
          return { type: TokenType.Boolean, value: false };
        }
        throw new Error(`Unexpected character after #: ${this.currentChar}`);
      default:
        throw new Error(`Unexpected character: ${char}`);
    }
  }

  async peek(): Promise<Token> {
    if (this.peekedToken === null) {
      this.peekedToken = await this.readNextToken();
    }
    return this.peekedToken;
  }

  async next(): Promise<Token> {
    if (this.peekedToken !== null) {
      const token = this.peekedToken;
      this.peekedToken = null;
      return token;
    }
    return this.readNextToken();
  }

  close(): void {
    this.input.close();
  }
}
