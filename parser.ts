import { TokenType, Lexer } from "./lexer";
import { SchemeId, SCons, SchemeType } from "./types";

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
