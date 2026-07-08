/**
 * Safe arithmetic expression evaluator for Open Avocado declarative widgets.
 *
 * SECURITY BOUNDARY
 * -----------------
 * Generated lesson widgets must never execute arbitrary JavaScript. This module
 * provides a small, self-contained expression language that is parsed into an
 * AST and evaluated against a fixed numeric scope. It deliberately does NOT use
 * `eval`, `new Function`, `with`, member access, property lookups, or strings.
 *
 * Supported grammar:
 *   - number literals (12, 3.14, .5)
 *   - identifiers (resolved from the provided scope; unknown -> 0)
 *   - constants: pi, e
 *   - unary: -x, !x
 *   - binary: + - * / % ^   (^ is exponentiation)
 *   - comparison: < <= > >= == !=   (yield 1 or 0)
 *   - logical: && ||   (truthiness, yield 1 or 0)
 *   - ternary: cond ? a : b
 *   - grouping: ( ... )
 *   - whitelisted functions: min, max, abs, sqrt, pow, exp, ln, log10,
 *     round, floor, ceil, clamp, sign
 *
 * Anything outside this grammar throws at parse time, so a malformed or
 * malicious formula fails loudly rather than executing.
 */

export type ExprNode =
  | { kind: "num"; value: number }
  | { kind: "ident"; name: string }
  | { kind: "unary"; op: "-" | "!"; arg: ExprNode }
  | { kind: "binary"; op: string; left: ExprNode; right: ExprNode }
  | { kind: "ternary"; cond: ExprNode; then: ExprNode; else: ExprNode }
  | { kind: "call"; name: string; args: ExprNode[] };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

type FnDef = { arity: number | [number, number]; fn: (args: number[]) => number };

const FUNCTIONS: Record<string, FnDef> = {
  min: { arity: [1, 8], fn: (a) => Math.min(...a) },
  max: { arity: [1, 8], fn: (a) => Math.max(...a) },
  abs: { arity: 1, fn: (a) => Math.abs(a[0]) },
  sqrt: { arity: 1, fn: (a) => Math.sqrt(a[0]) },
  pow: { arity: 2, fn: (a) => Math.pow(a[0], a[1]) },
  exp: { arity: 1, fn: (a) => Math.exp(a[0]) },
  ln: { arity: 1, fn: (a) => Math.log(a[0]) },
  log10: { arity: 1, fn: (a) => Math.log10(a[0]) },
  round: { arity: [1, 2], fn: (a) => { const p = a[1] ?? 0; const m = Math.pow(10, p); return Math.round(a[0] * m) / m; } },
  floor: { arity: 1, fn: (a) => Math.floor(a[0]) },
  ceil: { arity: 1, fn: (a) => Math.ceil(a[0]) },
  clamp: { arity: 3, fn: (a) => Math.min(Math.max(a[0], a[1]), a[2]) },
  sign: { arity: 1, fn: (a) => Math.sign(a[0]) },
};

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
  | { t: "num"; v: number }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "punc"; v: string };

const TWO_CHAR_OPS = new Set(["<=", ">=", "==", "!=", "&&", "||"]);
const ONE_CHAR_OPS = new Set(["+", "-", "*", "/", "%", "^", "<", ">", "!", "?", ":"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // numbers (incl. leading dot)
    if ((c >= "0" && c <= "9") || (c === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const raw = input.slice(i, j);
      if ((raw.match(/\./g) ?? []).length > 1) {
        throw new ExpressionError(`Invalid number "${raw}"`);
      }
      tokens.push({ t: "num", v: parseFloat(raw) });
      i = j;
      continue;
    }

    // identifiers
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j++;
      tokens.push({ t: "ident", v: input.slice(i, j) });
      i = j;
      continue;
    }

    // two-char operators
    const two = input.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ t: "op", v: two });
      i += 2;
      continue;
    }

    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ t: "punc", v: c });
      i++;
      continue;
    }

    if (ONE_CHAR_OPS.has(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }

    throw new ExpressionError(`Unexpected character "${c}" at position ${i}`);
  }
  return tokens;
}

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

// ─── Parser (recursive descent with precedence) ─────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }
  private expectPunc(v: string) {
    const tok = this.next();
    if (!tok || tok.t !== "punc" || tok.v !== v) {
      throw new ExpressionError(`Expected "${v}"`);
    }
  }

  parse(): ExprNode {
    const node = this.parseTernary();
    if (this.pos !== this.tokens.length) {
      throw new ExpressionError("Unexpected trailing tokens in expression");
    }
    return node;
  }

  private parseTernary(): ExprNode {
    const cond = this.parseBinary(0);
    const tok = this.peek();
    if (tok && tok.t === "op" && tok.v === "?") {
      this.next();
      const thenNode = this.parseTernary();
      const colon = this.next();
      if (!colon || colon.t !== "op" || colon.v !== ":") {
        throw new ExpressionError('Expected ":" in ternary expression');
      }
      const elseNode = this.parseTernary();
      return { kind: "ternary", cond, then: thenNode, else: elseNode };
    }
    return cond;
  }

  // precedence climbing
  private static PRECEDENCE: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "==": 3, "!=": 3,
    "<": 4, "<=": 4, ">": 4, ">=": 4,
    "+": 5, "-": 5,
    "*": 6, "/": 6, "%": 6,
    "^": 7,
  };

  private parseBinary(minPrec: number): ExprNode {
    let left = this.parseUnary();
    for (;;) {
      const tok = this.peek();
      if (!tok || tok.t !== "op" || !(tok.v in Parser.PRECEDENCE)) break;
      const prec = Parser.PRECEDENCE[tok.v];
      if (prec < minPrec) break;
      this.next();
      // ^ is right-associative
      const nextMin = tok.v === "^" ? prec : prec + 1;
      const right = this.parseBinary(nextMin);
      left = { kind: "binary", op: tok.v, left, right };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    const tok = this.peek();
    if (tok && tok.t === "op" && (tok.v === "-" || tok.v === "!")) {
      this.next();
      return { kind: "unary", op: tok.v as "-" | "!", arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    const tok = this.next();
    if (!tok) throw new ExpressionError("Unexpected end of expression");

    if (tok.t === "num") return { kind: "num", value: tok.v };

    if (tok.t === "punc" && tok.v === "(") {
      const node = this.parseTernary();
      this.expectPunc(")");
      return node;
    }

    if (tok.t === "ident") {
      const after = this.peek();
      if (after && after.t === "punc" && after.v === "(") {
        // function call
        this.next();
        const args: ExprNode[] = [];
        if (!(this.peek()?.t === "punc" && this.peek()?.v === ")")) {
          args.push(this.parseTernary());
          while (this.peek()?.t === "punc" && this.peek()?.v === ",") {
            this.next();
            args.push(this.parseTernary());
          }
        }
        this.expectPunc(")");
        if (!(tok.v in FUNCTIONS)) {
          throw new ExpressionError(`Unknown function "${tok.v}"`);
        }
        return { kind: "call", name: tok.v, args };
      }
      return { kind: "ident", name: tok.v };
    }

    throw new ExpressionError(`Unexpected token "${String(tok.v)}"`);
  }
}

/** Parse an expression string into an AST. Throws ExpressionError on bad syntax. */
export function parseExpression(input: string): ExprNode {
  if (typeof input !== "string") {
    throw new ExpressionError("Expression must be a string");
  }
  if (input.trim() === "") {
    throw new ExpressionError("Expression is empty");
  }
  if (input.length > 1000) {
    throw new ExpressionError("Expression too long");
  }
  return new Parser(tokenize(input)).parse();
}

/** Collect every identifier referenced by an expression (excluding constants/functions). */
export function collectIdentifiers(node: ExprNode, acc: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case "num":
      break;
    case "ident":
      if (!(node.name in CONSTANTS)) acc.add(node.name);
      break;
    case "unary":
      collectIdentifiers(node.arg, acc);
      break;
    case "binary":
      collectIdentifiers(node.left, acc);
      collectIdentifiers(node.right, acc);
      break;
    case "ternary":
      collectIdentifiers(node.cond, acc);
      collectIdentifiers(node.then, acc);
      collectIdentifiers(node.else, acc);
      break;
    case "call":
      node.args.forEach((a) => collectIdentifiers(a, acc));
      break;
  }
  return acc;
}

/** Evaluate an AST against a numeric scope. Unknown identifiers resolve to 0. */
export function evalAst(node: ExprNode, scope: Record<string, number>): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "ident":
      if (node.name in CONSTANTS) return CONSTANTS[node.name];
      return Number.isFinite(scope[node.name]) ? scope[node.name] : 0;
    case "unary": {
      const v = evalAst(node.arg, scope);
      return node.op === "-" ? -v : v ? 0 : 1;
    }
    case "ternary":
      return evalAst(node.cond, scope) ? evalAst(node.then, scope) : evalAst(node.else, scope);
    case "call": {
      const def = FUNCTIONS[node.name];
      if (!def) throw new ExpressionError(`Unknown function "${node.name}"`);
      const lo = Array.isArray(def.arity) ? def.arity[0] : def.arity;
      const hi = Array.isArray(def.arity) ? def.arity[1] : def.arity;
      if (node.args.length < lo || node.args.length > hi) {
        throw new ExpressionError(`Function "${node.name}" expects ${lo}-${hi} args`);
      }
      return def.fn(node.args.map((a) => evalAst(a, scope)));
    }
    case "binary": {
      const l = evalAst(node.left, scope);
      const r = evalAst(node.right, scope);
      switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return r === 0 ? 0 : l / r;
        case "%": return r === 0 ? 0 : l % r;
        case "^": return Math.pow(l, r);
        case "<": return l < r ? 1 : 0;
        case "<=": return l <= r ? 1 : 0;
        case ">": return l > r ? 1 : 0;
        case ">=": return l >= r ? 1 : 0;
        case "==": return l === r ? 1 : 0;
        case "!=": return l !== r ? 1 : 0;
        case "&&": return l && r ? 1 : 0;
        case "||": return l || r ? 1 : 0;
        default:
          throw new ExpressionError(`Unknown operator "${node.op}"`);
      }
    }
  }
}

/**
 * Convenience: parse + evaluate. Returns a finite number, or 0 if the result is
 * NaN/Infinity (so a widget never renders "NaN"). Throws on parse errors.
 */
export function evaluate(expr: string, scope: Record<string, number>): number {
  const result = evalAst(parseExpression(expr), scope);
  return Number.isFinite(result) ? result : 0;
}
