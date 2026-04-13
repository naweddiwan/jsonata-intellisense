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
      }
    });

    // Update when the document changes
    const changeDocSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
        this.currentDocument = e.document;
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
      margin-bottom: 16px;
    }
    .input-section {
      flex: 1;
      min-height: 200px;
      display: flex;
      flex-direction: column;
    }
    .output-section {
      flex: 1;
      min-height: 200px;
      display: flex;
      flex-direction: column;
    }
    textarea {
      flex: 1;
      width: 100%;
      padding: 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      resize: vertical;
      box-sizing: border-box;
    }
    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .output {
      flex: 1;
      padding: 8px;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 2px;
      overflow: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .error {
      color: var(--vscode-errorForeground);
    }
    button {
      padding: 6px 14px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 13px;
      margin-top: 8px;
      align-self: flex-start;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button:active {
      background-color: var(--vscode-button-background);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="section input-section">
      <h2>Input JSON</h2>
      <textarea id="input" placeholder='Paste your JSON here, e.g.:\n{\n  "name": "John",\n  "age": 30\n}'></textarea>
      <button id="evaluateBtn">Test Expression</button>
    </div>
    <div class="section output-section">
      <h2>Output</h2>
      <div id="output" class="output">Result will appear here...</div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const inputEl = document.getElementById('input');
    const outputEl = document.getElementById('output');
    const evaluateBtn = document.getElementById('evaluateBtn');

    // Restore previous state
    const previousState = vscode.getState();
    if (previousState && previousState.input) {
      inputEl.value = previousState.input;
    }

    // Save state when input changes
    inputEl.addEventListener('input', () => {
      vscode.setState({ input: inputEl.value });
    });

    function runEvaluation() {
      vscode.postMessage({
        command: 'evaluate',
        input: inputEl.value
      });
    }

    // Button click handler
    evaluateBtn.addEventListener('click', runEvaluation);

    // Handle Enter key with Cmd/Ctrl modifier
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        runEvaluation();
      }
    });

    // Receive results from extension
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'result') {
        if (message.error) {
          outputEl.textContent = message.error;
          outputEl.className = 'output error';
        } else {
          outputEl.textContent = message.output;
          outputEl.className = 'output';
        }
      }
    });
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
