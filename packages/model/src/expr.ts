/**
 * Tiny safe expression evaluator for rule packs.
 * Grammar: numbers, identifiers with dots (resolved against a context object), + - * / %,
 * comparisons < <= > >= == !=, logical && || !, parentheses, and functions min/max/abs/ceil/floor/round.
 * No assignment, no property access beyond dotted identifiers, no prototype access.
 */
export type Ctx = Record<string, unknown>;

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string } | { t: "lp" } | { t: "rp" } | { t: "comma" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.eE]/.test(src[j]!)) j++;
      out.push({ t: "num", v: parseFloat(src.slice(i, j)) }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_.]/.test(src[j]!)) j++;
      out.push({ t: "id", v: src.slice(i, j) }); i = j; continue;
    }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    if (c === ",") { out.push({ t: "comma" }); i++; continue; }
    const two = src.slice(i, i + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/%<>!".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`Unexpected character '${c}' at ${i}`);
  }
  return out;
}

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min, max: Math.max, abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round,
};

export function resolvePath(ctx: Ctx, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (p === "__proto__" || p === "constructor" || p === "prototype") return undefined;
    if (cur && typeof cur === "object" && Object.prototype.hasOwnProperty.call(cur, p)) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[], private ctx: Ctx) {}
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  expect(pred: (t: Tok | undefined) => boolean, msg: string) { const t = this.next(); if (!pred(t)) throw new Error(msg); return t!; }

  parseExpr(): unknown { return this.parseOr(); }
  parseOr(): unknown { let l = this.parseAnd(); while (this.isOp("||")) { this.next(); const r = this.parseAnd(); l = Boolean(l) || Boolean(r); } return l; }
  parseAnd(): unknown { let l = this.parseCmp(); while (this.isOp("&&")) { this.next(); const r = this.parseCmp(); l = Boolean(l) && Boolean(r); } return l; }
  parseCmp(): unknown {
    let l = this.parseAdd();
    while (this.isOp("<") || this.isOp("<=") || this.isOp(">") || this.isOp(">=") || this.isOp("==") || this.isOp("!=")) {
      const op = (this.next() as { v: string }).v; const r = this.parseAdd();
      const a = l as number, b = r as number;
      l = op === "<" ? a < b : op === "<=" ? a <= b : op === ">" ? a > b : op === ">=" ? a >= b : op === "==" ? a === b : a !== b;
    }
    return l;
  }
  parseAdd(): unknown { let l = this.parseMul(); while (this.isOp("+") || this.isOp("-")) { const op = (this.next() as { v: string }).v; const r = this.parseMul(); l = op === "+" ? (l as number) + (r as number) : (l as number) - (r as number); } return l; }
  parseMul(): unknown { let l = this.parseUnary(); while (this.isOp("*") || this.isOp("/") || this.isOp("%")) { const op = (this.next() as { v: string }).v; const r = this.parseUnary(); const a = l as number, b = r as number; l = op === "*" ? a * b : op === "/" ? a / b : a % b; } return l; }
  parseUnary(): unknown {
    if (this.isOp("!")) { this.next(); return !this.parseUnary(); }
    if (this.isOp("-")) { this.next(); return -(this.parseUnary() as number); }
    return this.parsePrimary();
  }
  parsePrimary(): unknown {
    const t = this.next();
    if (!t) throw new Error("Unexpected end");
    if (t.t === "num") return t.v;
    if (t.t === "lp") { const v = this.parseExpr(); this.expect((x) => x?.t === "rp", "Expected )"); return v; }
    if (t.t === "id") {
      if (this.peek()?.t === "lp" && FUNCS[t.v]) {
        this.next(); const args: number[] = [];
        if (this.peek()?.t !== "rp") { args.push(this.parseExpr() as number); while (this.peek()?.t === "comma") { this.next(); args.push(this.parseExpr() as number); } }
        this.expect((x) => x?.t === "rp", "Expected )");
        return FUNCS[t.v]!(...args);
      }
      if (t.v === "true") return true; if (t.v === "false") return false; if (t.v === "null") return null;
      return resolvePath(this.ctx, t.v);
    }
    throw new Error(`Unexpected token ${JSON.stringify(t)}`);
  }
  isOp(v: string) { const t = this.peek(); return t?.t === "op" && t.v === v; }
}

export function evaluate(expr: string, ctx: Ctx): unknown {
  const p = new Parser(tokenize(expr), ctx);
  const v = p.parseExpr();
  if (p.i !== p["toks"].length) throw new Error("Trailing tokens");
  return v;
}
