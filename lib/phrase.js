import { loadDefaultJapaneseParser } from "budoux";
import { esc } from "./text.js";

let parser;

function japanese() {
  if (!parser) parser = loadDefaultJapaneseParser();
  return parser;
}

// Insert <wbr> at BudouX phrase boundaries so Safari can break Japanese
// headings. Strings with no phrase boundary stay whole.
export function phrase(value) {
  const text = String(value ?? "");
  if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(text)) return esc(text);
  let parts = [text];
  try {
    parts = japanese().parse(text);
  } catch {
    parts = [text];
  }
  if (!parts || parts.length < 2) return esc(text);
  return parts.map((part) => esc(part)).join("<wbr>");
}
