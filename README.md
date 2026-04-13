# JSONata IntelliSense

Rich editing support for [JSONata](https://jsonata.org) (`.jsonata`) in VS Code-based IDEs.

## Features
- Syntax highlighting (TextMate grammar)
- Auto-completion for all 60+ built-in functions (`$map`, `$filter`, `$reduce`, …), keywords, and user-defined bindings
- Hover documentation with signatures and return types
- Signature help while typing function arguments
- Go to Definition for user-defined variables
- Find All References / Go to References for user-defined variables
- Document formatting (automatic indentation and code cleanup)
- Live parse-error diagnostics via the official `jsonata` engine
- **Interactive Expression Testing** - Test JSONata expressions against JSON input with live output
- Snippets for `function`, `:=`, blocks, `if`, `~> $map`, `~> $filter`, `~> $reduce`

## Usage
Open any file with a `.jsonata` extension.

### Testing JSONata Expressions
Test your JSONata expressions against sample JSON data:
1. Open a `.jsonata` file
2. Click the **Play button (▶)** in the top-right corner of the editor
3. Paste your JSON data in the **Input JSON** text area
4. Click **Test Expression** (or press Cmd/Ctrl+Enter)
5. View the output or any errors in the **Output** section

The test panel automatically saves your input JSON and updates when you switch between different `.jsonata` files.

### Navigation Features
- **Go to Definition**: Right-click on a variable usage and select "Go to Definition" (or press F12) to jump to where it's defined
- **Find All References**: Right-click on a variable definition or usage and select "Find All References" (or press Shift+F12) to see all places where it's used
- **Peek References**: Right-click and select "Peek References" to see references inline without leaving your current location

Example:
```jsonata
$myVariable := "value";  // Definition (line 1)

{
    "field": $myVariable  // Usage (line 4) - F12 here jumps to line 1
}
// Shift+F12 on line 1 shows both line 1 and line 4
```

## License
MIT
