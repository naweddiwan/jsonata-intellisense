import * as vscode from "vscode";
import { BUILTINS, KEYWORDS, Builtin } from "./builtins";

const LANG = "jsonata";
const SELECTOR: vscode.DocumentSelector = { language: LANG, scheme: "file" };

let jsonata: any;
try { jsonata = require("jsonata"); } catch { /* optional */ }

function builtinMarkdown(b: Builtin): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendCodeblock(`${b.signature} → ${b.returns}`, "jsonata");
  md.appendMarkdown(`\n**${b.category}** — ${b.doc}\n`);
  if (b.params.length) {
    md.appendMarkdown(`\n**Parameters**\n`);
    for (const p of b.params) {
      md.appendMarkdown(`- \`${p.name}${p.optional ? "?" : ""}: ${p.type}\`${p.doc ? ` — ${p.doc}` : ""}\n`);
    }
  }
  md.isTrusted = true;
  return md;
}

function findUserVars(doc: vscode.TextDocument, upTo: vscode.Position): string[] {
  const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), upTo));
  const names = new Set<string>();
  const re = /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*:=/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) names.add(m[1]);
  const lambdaRe = /function\s*\(([^)]*)\)/g;
  while ((m = lambdaRe.exec(text))) {
    for (const part of m[1].split(",")) {
      const t = part.trim().replace(/^\$/, "");
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) names.add(t);
    }
  }
  return [...names];
}

class CompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(doc: vscode.TextDocument, pos: vscode.Position) {
    const line = doc.lineAt(pos).text.substring(0, pos.character);
    const items: vscode.CompletionItem[] = [];

    if (/\$[a-zA-Z_]*$/.test(line)) {
      for (const b of BUILTINS) {
        const it = new vscode.CompletionItem("$" + b.name, vscode.CompletionItemKind.Function);
        it.detail = `${b.signature} → ${b.returns}`;
        it.documentation = builtinMarkdown(b);
        const args = b.params.filter(p => !p.optional).map((p, i) => `\${${i + 1}:${p.name}}`).join(", ");
        it.insertText = new vscode.SnippetString(`${b.name}(${args})$0`);
        it.filterText = "$" + b.name;
        items.push(it);
      }
      for (const v of findUserVars(doc, pos)) {
        const it = new vscode.CompletionItem("$" + v, vscode.CompletionItemKind.Variable);
        it.insertText = v;
        items.push(it);
      }
      return items;
    }

    for (const k of KEYWORDS) items.push(new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
    for (const b of BUILTINS) {
      const it = new vscode.CompletionItem("$" + b.name, vscode.CompletionItemKind.Function);
      it.detail = `${b.signature} → ${b.returns}`;
      it.documentation = builtinMarkdown(b);
      const args = b.params.filter(p => !p.optional).map((p, i) => `\${${i + 1}:${p.name}}`).join(", ");
      it.insertText = new vscode.SnippetString(`\\$${b.name}(${args})$0`);
      items.push(it);
    }
    return items;
  }
}

class HoverProvider implements vscode.HoverProvider {
  provideHover(doc: vscode.TextDocument, pos: vscode.Position) {
    const range = doc.getWordRangeAtPosition(pos, /\$[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!range) return;
    const word = doc.getText(range).substring(1);
    const b = BUILTINS.find(x => x.name === word);
    if (b) return new vscode.Hover(builtinMarkdown(b), range);
    const vars = findUserVars(doc, pos);
    if (vars.includes(word)) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(`$${word}`, "jsonata");
      md.appendMarkdown("\n_user-defined binding_");
      return new vscode.Hover(md, range);
    }
  }
}

class SignatureHelpProvider implements vscode.SignatureHelpProvider {
  provideSignatureHelp(doc: vscode.TextDocument, pos: vscode.Position) {
    const text = doc.getText(new vscode.Range(new vscode.Position(0, 0), pos));
    let depth = 0, commaIdx = 0, fnStart = -1;
    for (let i = text.length - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === ")") depth++;
      else if (ch === "(") { if (depth === 0) { fnStart = i; break; } depth--; }
      else if (ch === "," && depth === 0) commaIdx++;
    }
    if (fnStart < 0) return;
    const before = text.substring(0, fnStart);
    const m = /\$([a-zA-Z_][a-zA-Z0-9_]*)\s*$/.exec(before);
    if (!m) return;
    const b = BUILTINS.find(x => x.name === m[1]);
    if (!b) return;
    const sig = new vscode.SignatureInformation(b.signature, builtinMarkdown(b));
    sig.parameters = b.params.map(p => new vscode.ParameterInformation(`${p.name}${p.optional ? "?" : ""}: ${p.type}`, p.doc));
    const help = new vscode.SignatureHelp();
    help.signatures = [sig];
    help.activeSignature = 0;
    help.activeParameter = Math.min(commaIdx, b.params.length - 1);
    return help;
  }
}

class DefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(doc: vscode.TextDocument, pos: vscode.Position) {
    const range = doc.getWordRangeAtPosition(pos, /\$[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!range) return;
    const name = doc.getText(range).substring(1);
    const text = doc.getText();
    const locations: vscode.Location[] = [];

    const assignRe = new RegExp(`\\$(${name})\\s*:=`, "g");
    let m: RegExpExecArray | null;
    while ((m = assignRe.exec(text))) {
      const start = doc.positionAt(m.index + 1);
      const end = doc.positionAt(m.index + 1 + name.length);
      locations.push(new vscode.Location(doc.uri, new vscode.Range(start, end)));
    }

    const lambdaRe = /function\s*\(([^)]*)\)/g;
    while ((m = lambdaRe.exec(text))) {
      const paramsStart = m.index + m[0].indexOf("(") + 1;
      const params = m[1];
      let offset = 0;
      for (const part of params.split(",")) {
        const trimmed = part.replace(/^\s*\$?/, "");
        const leading = part.length - part.replace(/^\s*\$?/, "").length;
        const nameMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)/.exec(trimmed);
        if (nameMatch && nameMatch[1] === name) {
          const s = paramsStart + offset + leading;
          locations.push(new vscode.Location(doc.uri, new vscode.Range(doc.positionAt(s), doc.positionAt(s + name.length))));
        }
        offset += part.length + 1;
      }
    }
    return locations;
  }
}

class ReferenceProvider implements vscode.ReferenceProvider {
  provideReferences(doc: vscode.TextDocument, pos: vscode.Position) {
    const range = doc.getWordRangeAtPosition(pos, /\$[a-zA-Z_][a-zA-Z0-9_]*/);
    if (!range) return;
    const name = doc.getText(range).substring(1);
    const text = doc.getText();
    const locations: vscode.Location[] = [];

    // Find all occurrences of $name (including assignments and usages)
    const varRe = new RegExp(`\\$${name}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = varRe.exec(text))) {
      const start = doc.positionAt(m.index + 1);
      const end = doc.positionAt(m.index + 1 + name.length);
      locations.push(new vscode.Location(doc.uri, new vscode.Range(start, end)));
    }

    // Also find function parameter definitions (without $ prefix)
    const lambdaRe = /function\s*\(([^)]*)\)/g;
    while ((m = lambdaRe.exec(text))) {
      const paramsStart = m.index + m[0].indexOf("(") + 1;
      const params = m[1];
      let offset = 0;
      for (const part of params.split(",")) {
        const trimmed = part.replace(/^\s*\$?/, "");
        const leading = part.length - part.replace(/^\s*\$?/, "").length;
        const nameMatch = /^([a-zA-Z_][a-zA-Z0-9_]*)/.exec(trimmed);
        if (nameMatch && nameMatch[1] === name) {
          const s = paramsStart + offset + leading;
          locations.push(new vscode.Location(doc.uri, new vscode.Range(doc.positionAt(s), doc.positionAt(s + name.length))));
        }
        offset += part.length + 1;
      }
    }

    return locations;
  }
}

function stripStringsAndComments(line: string): string {
  let out = "";
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === "\\") i++;
        i++;
      }
      i++;
      out += " ";
      continue;
    }
    if (ch === "/" && line[i + 1] === "*") {
      i += 2;
      while (i < line.length && !(line[i] === "*" && line[i + 1] === "/")) i++;
      i += 2;
      out += " ";
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

class FormattingProvider implements vscode.DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(doc: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    const indentUnit = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    const lines = doc.getText().split(/\r?\n/);
    const out: string[] = [];
    let depth = 0;
    let inBlockComment = false;

    for (const raw of lines) {
      let line = raw.replace(/\s+$/, "");
      const trimmed = line.trim();

      if (inBlockComment) {
        out.push(raw.replace(/\s+$/, ""));
        if (/\*\//.test(line)) inBlockComment = false;
        continue;
      }
      if (trimmed === "") { out.push(""); continue; }

      const stripped = stripStringsAndComments(trimmed);

      let leadingClosers = 0;
      for (const c of stripped) {
        if (c === ")" || c === "]" || c === "}") leadingClosers++;
        else if (!/\s/.test(c)) break;
      }
      const indent = indentUnit.repeat(Math.max(0, depth - leadingClosers));
      out.push(indent + trimmed);

      for (const c of stripped) {
        if (c === "(" || c === "[" || c === "{") depth++;
        else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
      }

      const openBlock = /\/\*/.test(trimmed) && !/\*\//.test(trimmed.slice(trimmed.indexOf("/*") + 2));
      if (openBlock) inBlockComment = true;
    }

    const newText = out.join("\n");
    const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
    return [vscode.TextEdit.replace(fullRange, newText)];
  }
}

function validate(doc: vscode.TextDocument, diags: vscode.DiagnosticCollection) {
  if (doc.languageId !== LANG) return;
  const list: vscode.Diagnostic[] = [];
  if (jsonata) {
    try { jsonata(doc.getText()); }
    catch (e: any) {
      const pos = typeof e.position === "number" ? e.position : 0;
      const start = doc.positionAt(pos);
      const end = doc.positionAt(Math.min(pos + (e.token?.length || 1), doc.getText().length));
      const msg = e.message ? `${e.code ? "[" + e.code + "] " : ""}${e.message}` : "JSONata parse error";
      list.push(new vscode.Diagnostic(new vscode.Range(start, end), msg, vscode.DiagnosticSeverity.Error));
    }
  }
  diags.set(doc.uri, list);
}

class TestPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public show() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== LANG) {
      vscode.window.showErrorMessage("Please open a JSONata file first.");
      return;
    }

    this.currentDocument = editor.document;

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "jsonataTest",
        "Test JSONata",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.webview.html = this.getWebviewContent();

      this.panel.webview.onDidReceiveMessage(
        async (message) => {
          if (message.command === "evaluate") {
            this.evaluateExpression(message.input);
          }
        },
        undefined,
        this.context.subscriptions
      );

      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
        },
        undefined,
        this.context.subscriptions
      );
    }

    // Update the expression when the active editor changes
    const changeEditorSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === LANG) {
        this.currentDocument = editor.document;
        this.panel?.webview.postMessage({ command: "reevaluate" });
      }
    });

    // Update when the document changes
    const changeDocSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
        this.currentDocument = e.document;
        this.panel?.webview.postMessage({ command: "reevaluate" });
      }
    });

    this.context.subscriptions.push(changeEditorSub, changeDocSub);
  }

  private async evaluateExpression(inputJson: string) {
    if (!this.panel) return;
    if (!this.currentDocument) {
      this.panel.webview.postMessage({
        command: "result",
        error: "No JSONata document is active.",
      });
      return;
    }

    const expression = this.currentDocument.getText();

    if (!jsonata) {
      this.panel.webview.postMessage({
        command: "result",
        error: "JSONata library is not available. Please install it: npm install jsonata",
      });
      return;
    }

    try {
      if (!inputJson || inputJson.trim() === "") {
        this.panel.webview.postMessage({
          command: "result",
          error: "Please provide input JSON",
        });
        return;
      }

      let inputData: any;
      try {
        inputData = JSON.parse(inputJson);
      } catch (parseErr: any) {
        this.panel.webview.postMessage({
          command: "result",
          error: `Invalid JSON input: ${parseErr.message}`,
        });
        return;
      }

      const compiled = jsonata(expression);
      const result = await compiled.evaluate(inputData);

      this.panel.webview.postMessage({
        command: "result",
        output: JSON.stringify(result, null, 2),
      });
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      const position = err.position !== undefined ? ` at position ${err.position}` : "";
      this.panel.webview.postMessage({
        command: "result",
        error: `${errorMsg}${position}`,
      });
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test JSONata</title>
  <style>
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 12px;
      box-sizing: border-box;
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    .section {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .input-section {
      flex: 1 1 0;
      min-height: 80px;
    }
    .output-section {
      flex: 1 1 0;
      min-height: 80px;
    }
    .splitter {
      flex: 0 0 10px;
      position: relative;
      cursor: ns-resize;
      background: transparent;
    }
    .splitter::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--vscode-panel-border);
      transform: translateY(-50%);
      transition: background-color 0.1s ease;
    }
    .splitter:hover::after,
    .splitter.dragging::after {
      background: var(--vscode-focusBorder);
      height: 3px;
    }
    body.resizing {
      cursor: ns-resize;
      user-select: none;
    }
    .editor {
      flex: 1;
      position: relative;
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      background-color: var(--vscode-input-background);
      overflow: hidden;
    }
    .editor:focus-within {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .editor .highlight,
    .editor textarea {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      padding: 8px;
      margin: 0;
      border: 0;
      box-sizing: border-box;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
      overflow: auto;
      tab-size: 2;
    }
    .editor .highlight {
      pointer-events: none;
      color: var(--vscode-input-foreground);
      z-index: 0;
    }
    .editor textarea {
      background: transparent;
      color: transparent;
      caret-color: var(--vscode-input-foreground);
      resize: none;
      outline: none;
      z-index: 1;
    }
    .editor textarea::selection {
      background: var(--vscode-editor-selectionBackground);
    }
    .editor textarea::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .output {
      flex: 1;
      margin: 0;
      padding: 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.5;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 2px;
      overflow: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
      box-sizing: border-box;
    }
    .error {
      color: var(--vscode-errorForeground);
    }
    .json-key { color: var(--vscode-debugTokenExpression-name, #9cdcfe); }
    .json-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
    .json-number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
    .json-boolean { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
    .json-null { color: var(--vscode-debugTokenExpression-boolean, #569cd6); }
    .findbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      margin-bottom: 8px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 2px;
    }
    .findbar[hidden] { display: none; }
    .findbar input {
      flex: 1;
      min-width: 0;
      padding: 3px 6px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      outline: none;
      font-family: var(--vscode-font-family);
      font-size: 12px;
    }
    .findbar input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .find-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      min-width: 56px;
      text-align: center;
      white-space: nowrap;
    }
    .findbar button {
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      padding: 2px 6px;
      cursor: pointer;
      border-radius: 2px;
      font-size: 13px;
      line-height: 1;
    }
    .findbar button:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.2));
    }
    .findbar button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    mark.search-match {
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
      color: inherit;
      border-radius: 2px;
      padding: 0;
    }
    mark.search-match.active {
      background: var(--vscode-editor-findMatchBackground, rgba(166, 120, 66, 0.66));
      outline: 1px solid var(--vscode-editor-findMatchBorder, transparent);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="section input-section">
      <h2>Input JSON</h2>
      <div class="findbar" id="findbarInput" hidden>
        <input id="findInputQuery" type="text" placeholder="Find in input..." />
        <span class="find-count" id="findInputCount"></span>
        <button id="findInputPrev" title="Previous match (Shift+Enter)">&#8593;</button>
        <button id="findInputNext" title="Next match (Enter)">&#8595;</button>
        <button id="findInputClose" title="Close (Escape)">&#10005;</button>
      </div>
      <div class="editor">
        <pre id="inputHighlight" class="highlight" aria-hidden="true"></pre>
        <textarea id="input" spellcheck="false" placeholder='Paste your JSON here, e.g.:\n{\n  "name": "John",\n  "age": 30\n}'></textarea>
      </div>
    </div>
    <div class="splitter" id="splitter" title="Drag to resize"></div>
    <div class="section output-section">
      <h2>Output</h2>
      <div class="findbar" id="findbarOutput" hidden>
        <input id="findOutputQuery" type="text" placeholder="Find in output..." />
        <span class="find-count" id="findOutputCount"></span>
        <button id="findOutputPrev" title="Previous match (Shift+Enter)">&#8593;</button>
        <button id="findOutputNext" title="Next match (Enter)">&#8595;</button>
        <button id="findOutputClose" title="Close (Escape)">&#10005;</button>
      </div>
      <pre id="output" class="output" tabindex="0">Result will appear here...</pre>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const inputEl = document.getElementById('input');
    const inputHighlightEl = document.getElementById('inputHighlight');
    const outputEl = document.getElementById('output');
    const inputSectionEl = inputEl.closest('.section');
    const outputSectionEl = outputEl.closest('.section');
    const splitterEl = document.getElementById('splitter');
    const containerEl = document.querySelector('.container');

    function updateState(patch) {
      const prev = vscode.getState() || {};
      vscode.setState(Object.assign({}, prev, patch));
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function highlightJson(str) {
      const escaped = escapeHtml(str);
      return escaped.replace(
        /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\\s*:)?|\\b(?:true|false|null)\\b|-?\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?)/g,
        (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            cls = /:$/.test(match) ? 'json-key' : 'json-string';
          } else if (/^(true|false)$/.test(match)) {
            cls = 'json-boolean';
          } else if (match === 'null') {
            cls = 'json-null';
          }
          return '<span class="' + cls + '">' + match + '</span>';
        }
      );
    }

    function updateInputHighlight() {
      // Trailing newline ensures the highlight box matches textarea height
      const text = inputEl.value + (inputEl.value.endsWith('\\n') ? ' ' : '');
      inputHighlightEl.innerHTML = highlightJson(text);
    }

    function syncScroll() {
      inputHighlightEl.scrollTop = inputEl.scrollTop;
      inputHighlightEl.scrollLeft = inputEl.scrollLeft;
    }

    // Restore previous state
    const previousState = vscode.getState();
    if (previousState && previousState.input) {
      inputEl.value = previousState.input;
    }
    let inputRatio = (previousState && typeof previousState.inputRatio === 'number')
      ? previousState.inputRatio
      : 0.5;
    function applyRatio() {
      inputSectionEl.style.flex = inputRatio + ' 1 0';
      outputSectionEl.style.flex = (1 - inputRatio) + ' 1 0';
    }
    applyRatio();
    updateInputHighlight();

    // Splitter drag
    let dragState = null;
    splitterEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const containerRect = containerEl.getBoundingClientRect();
      const cs = getComputedStyle(containerEl);
      const paddingTop = parseFloat(cs.paddingTop);
      const paddingBottom = parseFloat(cs.paddingBottom);
      const available = containerRect.height - paddingTop - paddingBottom - splitterEl.offsetHeight;
      dragState = {
        containerTop: containerRect.top + paddingTop,
        available,
      };
      splitterEl.classList.add('dragging');
      document.body.classList.add('resizing');
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragState) return;
      const minH = 80;
      let newInputH = e.clientY - dragState.containerTop;
      newInputH = Math.max(minH, Math.min(newInputH, dragState.available - minH));
      inputRatio = newInputH / dragState.available;
      applyRatio();
    });
    window.addEventListener('mouseup', () => {
      if (!dragState) return;
      dragState = null;
      splitterEl.classList.remove('dragging');
      document.body.classList.remove('resizing');
      updateState({ inputRatio });
    });

    function runEvaluation() {
      vscode.postMessage({
        command: 'evaluate',
        input: inputEl.value
      });
    }

    let debounceTimer;
    function scheduleEvaluation() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runEvaluation, 300);
    }

    // --- Find / search support (per section) ---
    function clearHighlights(container) {
      const marks = container.querySelectorAll('mark.search-match');
      marks.forEach(m => {
        const parent = m.parentNode;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
      });
      container.normalize();
    }

    function highlightMatchesIn(container, query) {
      clearHighlights(container);
      if (!query) return [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      const matches = [];
      const lowerQuery = query.toLowerCase();
      textNodes.forEach(node => {
        const text = node.nodeValue;
        if (!text) return;
        const lower = text.toLowerCase();
        let idx = lower.indexOf(lowerQuery);
        if (idx === -1) return;
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        while (idx !== -1) {
          if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
          const mark = document.createElement('mark');
          mark.className = 'search-match';
          mark.textContent = text.slice(idx, idx + query.length);
          frag.appendChild(mark);
          matches.push(mark);
          lastIdx = idx + query.length;
          idx = lower.indexOf(lowerQuery, lastIdx);
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        node.parentNode.replaceChild(frag, node);
      });
      return matches;
    }

    function createFindController(opts) {
      const { bar, query, count, prev, next, close, target, returnFocus, onScroll } = opts;
      let matches = [];
      let activeIdx = -1;

      function updateCount() {
        if (!query.value) {
          count.textContent = '';
        } else if (matches.length === 0) {
          count.textContent = 'No results';
        } else {
          count.textContent = (activeIdx + 1) + ' / ' + matches.length;
        }
        const disabled = matches.length === 0;
        prev.disabled = disabled;
        next.disabled = disabled;
      }

      function setActive(scrollIntoView) {
        matches.forEach(m => m.classList.remove('active'));
        if (activeIdx >= 0 && activeIdx < matches.length) {
          const active = matches[activeIdx];
          active.classList.add('active');
          if (scrollIntoView) {
            active.scrollIntoView({ block: 'center', behavior: 'smooth' });
            if (onScroll) requestAnimationFrame(onScroll);
          }
        }
      }

      function apply(preserveActive) {
        if (bar.hidden) return;
        const prevIdx = preserveActive ? activeIdx : -1;
        matches = highlightMatchesIn(target, query.value);
        if (matches.length === 0) {
          activeIdx = -1;
        } else if (prevIdx >= 0 && prevIdx < matches.length) {
          activeIdx = prevIdx;
        } else {
          activeIdx = 0;
        }
        setActive(false);
        updateCount();
      }

      function show() {
        const wasHidden = bar.hidden;
        bar.hidden = false;
        query.focus();
        query.select();
        if (wasHidden && query.value) apply(false);
      }

      function hide() {
        bar.hidden = true;
        clearHighlights(target);
        matches = [];
        activeIdx = -1;
        if (returnFocus) returnFocus.focus();
      }

      function move(delta) {
        if (matches.length === 0) return;
        activeIdx = (activeIdx + delta + matches.length) % matches.length;
        setActive(true);
        updateCount();
      }

      query.addEventListener('input', () => apply(false));
      next.addEventListener('click', () => move(1));
      prev.addEventListener('click', () => move(-1));
      close.addEventListener('click', hide);
      query.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          move(e.shiftKey ? -1 : 1);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hide();
        }
      });

      return { apply, show, hide, isOpen: () => !bar.hidden };
    }

    const inputFind = createFindController({
      bar: document.getElementById('findbarInput'),
      query: document.getElementById('findInputQuery'),
      count: document.getElementById('findInputCount'),
      prev: document.getElementById('findInputPrev'),
      next: document.getElementById('findInputNext'),
      close: document.getElementById('findInputClose'),
      target: inputHighlightEl,
      returnFocus: inputEl,
      onScroll: () => {
        inputEl.scrollTop = inputHighlightEl.scrollTop;
        inputEl.scrollLeft = inputHighlightEl.scrollLeft;
      },
    });

    const outputFind = createFindController({
      bar: document.getElementById('findbarOutput'),
      query: document.getElementById('findOutputQuery'),
      count: document.getElementById('findOutputCount'),
      prev: document.getElementById('findOutputPrev'),
      next: document.getElementById('findOutputNext'),
      close: document.getElementById('findOutputClose'),
      target: outputEl,
      returnFocus: outputEl,
    });

    function findControllerForFocus() {
      const active = document.activeElement;
      if (active && outputSectionEl.contains(active)) return outputFind;
      return inputFind;
    }

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        findControllerForFocus().show();
      } else if (e.key === 'Escape') {
        if (inputFind.isOpen() || outputFind.isOpen()) {
          e.preventDefault();
          if (inputFind.isOpen()) inputFind.hide();
          if (outputFind.isOpen()) outputFind.hide();
        }
      }
    });

    // Auto-evaluate on input changes (debounced)
    inputEl.addEventListener('input', () => {
      updateState({ input: inputEl.value });
      updateInputHighlight();
      inputFind.apply(true);
      scheduleEvaluation();
    });

    inputEl.addEventListener('scroll', syncScroll);

    // Receive results and re-evaluation triggers from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'result') {
        if (message.error) {
          outputEl.textContent = message.error;
          outputEl.className = 'output error';
        } else {
          outputEl.innerHTML = highlightJson(message.output);
          outputEl.className = 'output';
        }
        outputFind.apply(true);
      } else if (message.command === 'reevaluate') {
        scheduleEvaluation();
      }
    });

    // Evaluate on initial load if there's existing input
    if (inputEl.value.trim() !== '') {
      scheduleEvaluation();
    }
  </script>
</body>
</html>`;
  }
}

export function activate(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(SELECTOR, new CompletionProvider(), "$", "."),
    vscode.languages.registerHoverProvider(SELECTOR, new HoverProvider()),
    vscode.languages.registerSignatureHelpProvider(SELECTOR, new SignatureHelpProvider(), "(", ","),
    vscode.languages.registerDefinitionProvider(SELECTOR, new DefinitionProvider()),
    vscode.languages.registerReferenceProvider(SELECTOR, new ReferenceProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, new FormattingProvider())
  );

  const diags = vscode.languages.createDiagnosticCollection(LANG);
  ctx.subscriptions.push(diags);
  if (vscode.window.activeTextEditor) validate(vscode.window.activeTextEditor.document, diags);
  ctx.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(d => validate(d, diags)),
    vscode.workspace.onDidChangeTextDocument(e => validate(e.document, diags)),
    vscode.workspace.onDidCloseTextDocument(d => diags.delete(d.uri))
  );

  // Register the test expression command
  const testPanel = new TestPanelProvider(ctx);
  ctx.subscriptions.push(
    vscode.commands.registerCommand("jsonata.testExpression", () => testPanel.show())
  );
}

export function deactivate() {}
