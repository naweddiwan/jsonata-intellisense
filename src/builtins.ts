export interface Builtin {
  name: string;
  signature: string;
  returns: string;
  category: string;
  doc: string;
  params: { name: string; type: string; optional?: boolean; doc?: string }[];
}

export const BUILTINS: Builtin[] = [
  // String
  { name: "string", signature: "$string(arg, prettify?)", returns: "string", category: "String",
    doc: "Casts the argument to a string using JSON serialization for objects/arrays. `prettify` adds indentation.",
    params: [{ name: "arg", type: "any" }, { name: "prettify", type: "boolean", optional: true }] },
  { name: "length", signature: "$length(str)", returns: "number", category: "String",
    doc: "Returns the number of characters in the string.",
    params: [{ name: "str", type: "string" }] },
  { name: "substring", signature: "$substring(str, start, length?)", returns: "string", category: "String",
    doc: "Returns a substring starting at `start`. If `length` omitted, returns the rest.",
    params: [{ name: "str", type: "string" }, { name: "start", type: "number" }, { name: "length", type: "number", optional: true }] },
  { name: "substringBefore", signature: "$substringBefore(str, chars)", returns: "string", category: "String",
    doc: "Returns the portion of `str` before the first occurrence of `chars`.",
    params: [{ name: "str", type: "string" }, { name: "chars", type: "string" }] },
  { name: "substringAfter", signature: "$substringAfter(str, chars)", returns: "string", category: "String",
    doc: "Returns the portion of `str` after the first occurrence of `chars`.",
    params: [{ name: "str", type: "string" }, { name: "chars", type: "string" }] },
  { name: "uppercase", signature: "$uppercase(str)", returns: "string", category: "String", doc: "Converts to uppercase.", params: [{ name: "str", type: "string" }] },
  { name: "lowercase", signature: "$lowercase(str)", returns: "string", category: "String", doc: "Converts to lowercase.", params: [{ name: "str", type: "string" }] },
  { name: "trim", signature: "$trim(str)", returns: "string", category: "String", doc: "Normalizes and trims whitespace.", params: [{ name: "str", type: "string" }] },
  { name: "pad", signature: "$pad(str, width, char?)", returns: "string", category: "String",
    doc: "Pads to `width`. Negative `width` pads left; positive pads right.",
    params: [{ name: "str", type: "string" }, { name: "width", type: "number" }, { name: "char", type: "string", optional: true }] },
  { name: "contains", signature: "$contains(str, pattern)", returns: "boolean", category: "String",
    doc: "True if `str` contains `pattern` (string or regex).",
    params: [{ name: "str", type: "string" }, { name: "pattern", type: "string | regex" }] },
  { name: "split", signature: "$split(str, separator, limit?)", returns: "array<string>", category: "String",
    doc: "Splits `str` by `separator` (string or regex).",
    params: [{ name: "str", type: "string" }, { name: "separator", type: "string | regex" }, { name: "limit", type: "number", optional: true }] },
  { name: "join", signature: "$join(array, separator?)", returns: "string", category: "String",
    doc: "Joins an array of strings using `separator`.",
    params: [{ name: "array", type: "array<string>" }, { name: "separator", type: "string", optional: true }] },
  { name: "match", signature: "$match(str, pattern, limit?)", returns: "array", category: "String",
    doc: "Regex match — returns array of `{ match, index, groups }`.",
    params: [{ name: "str", type: "string" }, { name: "pattern", type: "regex" }, { name: "limit", type: "number", optional: true }] },
  { name: "replace", signature: "$replace(str, pattern, replacement, limit?)", returns: "string", category: "String",
    doc: "Replaces occurrences of `pattern` with `replacement` (string or function).",
    params: [{ name: "str", type: "string" }, { name: "pattern", type: "string | regex" }, { name: "replacement", type: "string | function" }, { name: "limit", type: "number", optional: true }] },
  { name: "eval", signature: "$eval(expr, context?)", returns: "any", category: "String",
    doc: "Parses and evaluates a JSONata expression string.",
    params: [{ name: "expr", type: "string" }, { name: "context", type: "any", optional: true }] },
  { name: "base64encode", signature: "$base64encode(str)", returns: "string", category: "String", doc: "Base64-encode a string.", params: [{ name: "str", type: "string" }] },
  { name: "base64decode", signature: "$base64decode(str)", returns: "string", category: "String", doc: "Base64-decode a string.", params: [{ name: "str", type: "string" }] },
  { name: "encodeUrlComponent", signature: "$encodeUrlComponent(str)", returns: "string", category: "String", doc: "URL-encode a component.", params: [{ name: "str", type: "string" }] },
  { name: "encodeUrl", signature: "$encodeUrl(str)", returns: "string", category: "String", doc: "URL-encode a full URL.", params: [{ name: "str", type: "string" }] },
  { name: "decodeUrlComponent", signature: "$decodeUrlComponent(str)", returns: "string", category: "String", doc: "URL-decode a component.", params: [{ name: "str", type: "string" }] },
  { name: "decodeUrl", signature: "$decodeUrl(str)", returns: "string", category: "String", doc: "URL-decode a full URL.", params: [{ name: "str", type: "string" }] },

  // Number
  { name: "number", signature: "$number(arg)", returns: "number", category: "Numeric", doc: "Casts the argument to a number.", params: [{ name: "arg", type: "any" }] },
  { name: "abs", signature: "$abs(number)", returns: "number", category: "Numeric", doc: "Absolute value.", params: [{ name: "number", type: "number" }] },
  { name: "floor", signature: "$floor(number)", returns: "number", category: "Numeric", doc: "Rounds down.", params: [{ name: "number", type: "number" }] },
  { name: "ceil", signature: "$ceil(number)", returns: "number", category: "Numeric", doc: "Rounds up.", params: [{ name: "number", type: "number" }] },
  { name: "round", signature: "$round(number, precision?)", returns: "number", category: "Numeric",
    doc: "Rounds half-to-even to given decimal `precision`.",
    params: [{ name: "number", type: "number" }, { name: "precision", type: "number", optional: true }] },
  { name: "power", signature: "$power(base, exponent)", returns: "number", category: "Numeric", doc: "`base ^ exponent`.", params: [{ name: "base", type: "number" }, { name: "exponent", type: "number" }] },
  { name: "sqrt", signature: "$sqrt(number)", returns: "number", category: "Numeric", doc: "Square root.", params: [{ name: "number", type: "number" }] },
  { name: "random", signature: "$random()", returns: "number", category: "Numeric", doc: "Random number in [0,1).", params: [] },
  { name: "formatNumber", signature: "$formatNumber(number, picture, options?)", returns: "string", category: "Numeric",
    doc: "Formats a number using an XPath 3.1 picture string.",
    params: [{ name: "number", type: "number" }, { name: "picture", type: "string" }, { name: "options", type: "object", optional: true }] },
  { name: "formatBase", signature: "$formatBase(number, radix?)", returns: "string", category: "Numeric",
    doc: "Formats an integer in the given radix (2-36).",
    params: [{ name: "number", type: "number" }, { name: "radix", type: "number", optional: true }] },
  { name: "formatInteger", signature: "$formatInteger(number, picture)", returns: "string", category: "Numeric",
    doc: "Formats an integer per XPath picture string.",
    params: [{ name: "number", type: "number" }, { name: "picture", type: "string" }] },
  { name: "parseInteger", signature: "$parseInteger(string, picture)", returns: "number", category: "Numeric",
    doc: "Parses a formatted integer using picture string.",
    params: [{ name: "string", type: "string" }, { name: "picture", type: "string" }] },

  // Aggregation
  { name: "sum", signature: "$sum(array)", returns: "number", category: "Aggregation", doc: "Sum of numeric array.", params: [{ name: "array", type: "array<number>" }] },
  { name: "max", signature: "$max(array)", returns: "number", category: "Aggregation", doc: "Maximum value.", params: [{ name: "array", type: "array<number>" }] },
  { name: "min", signature: "$min(array)", returns: "number", category: "Aggregation", doc: "Minimum value.", params: [{ name: "array", type: "array<number>" }] },
  { name: "average", signature: "$average(array)", returns: "number", category: "Aggregation", doc: "Arithmetic mean.", params: [{ name: "array", type: "array<number>" }] },

  // Boolean
  { name: "boolean", signature: "$boolean(arg)", returns: "boolean", category: "Boolean", doc: "Casts to boolean via JSONata truthiness rules.", params: [{ name: "arg", type: "any" }] },
  { name: "not", signature: "$not(arg)", returns: "boolean", category: "Boolean", doc: "Logical NOT.", params: [{ name: "arg", type: "any" }] },
  { name: "exists", signature: "$exists(arg)", returns: "boolean", category: "Boolean", doc: "True if expression resolves to a value.", params: [{ name: "arg", type: "any" }] },

  // Array
  { name: "count", signature: "$count(array)", returns: "number", category: "Array", doc: "Number of items.", params: [{ name: "array", type: "array" }] },
  { name: "append", signature: "$append(array1, array2)", returns: "array", category: "Array", doc: "Concatenates two arrays.", params: [{ name: "array1", type: "array" }, { name: "array2", type: "array" }] },
  { name: "sort", signature: "$sort(array, comparator?)", returns: "array", category: "Array",
    doc: "Sorts an array. Optional comparator `function($l,$r) { ... }`.",
    params: [{ name: "array", type: "array" }, { name: "comparator", type: "function", optional: true }] },
  { name: "reverse", signature: "$reverse(array)", returns: "array", category: "Array", doc: "Reverses an array.", params: [{ name: "array", type: "array" }] },
  { name: "shuffle", signature: "$shuffle(array)", returns: "array", category: "Array", doc: "Randomizes array order.", params: [{ name: "array", type: "array" }] },
  { name: "distinct", signature: "$distinct(array)", returns: "array", category: "Array", doc: "Removes duplicates.", params: [{ name: "array", type: "array" }] },
  { name: "zip", signature: "$zip(array1, ...)", returns: "array", category: "Array", doc: "Zips arrays pairwise.", params: [{ name: "arrays", type: "...array" }] },

  // Object
  { name: "keys", signature: "$keys(object)", returns: "array<string>", category: "Object", doc: "Returns object keys.", params: [{ name: "object", type: "object" }] },
  { name: "lookup", signature: "$lookup(object, key)", returns: "any", category: "Object", doc: "Returns the value for the given key.", params: [{ name: "object", type: "object" }, { name: "key", type: "string" }] },
  { name: "spread", signature: "$spread(object)", returns: "array<object>", category: "Object", doc: "Splits object into array of single key/value objects.", params: [{ name: "object", type: "object" }] },
  { name: "merge", signature: "$merge(array)", returns: "object", category: "Object", doc: "Merges an array of objects into one.", params: [{ name: "array", type: "array<object>" }] },
  { name: "sift", signature: "$sift(object, predicate)", returns: "object", category: "Object",
    doc: "Filters key/value pairs via `function($v, $k) { ... }`.",
    params: [{ name: "object", type: "object" }, { name: "predicate", type: "function" }] },
  { name: "each", signature: "$each(object, fn)", returns: "array", category: "Object",
    doc: "Maps `function($v, $k)` over each key/value pair.",
    params: [{ name: "object", type: "object" }, { name: "fn", type: "function" }] },
  { name: "error", signature: "$error(message?)", returns: "never", category: "Object", doc: "Throws an error.", params: [{ name: "message", type: "string", optional: true }] },
  { name: "assert", signature: "$assert(condition, message?)", returns: "undefined", category: "Object",
    doc: "Throws error with `message` if `condition` is false.",
    params: [{ name: "condition", type: "any" }, { name: "message", type: "string", optional: true }] },
  { name: "type", signature: "$type(value)", returns: "string", category: "Object", doc: "Returns the type name of value.", params: [{ name: "value", type: "any" }] },

  // Date/Time
  { name: "now", signature: "$now(picture?, timezone?)", returns: "string", category: "DateTime",
    doc: "Current timestamp formatted per optional picture.",
    params: [{ name: "picture", type: "string", optional: true }, { name: "timezone", type: "string", optional: true }] },
  { name: "millis", signature: "$millis()", returns: "number", category: "DateTime", doc: "Milliseconds since epoch.", params: [] },
  { name: "fromMillis", signature: "$fromMillis(number, picture?, timezone?)", returns: "string", category: "DateTime",
    doc: "Converts epoch ms to a formatted timestamp.",
    params: [{ name: "number", type: "number" }, { name: "picture", type: "string", optional: true }, { name: "timezone", type: "string", optional: true }] },
  { name: "toMillis", signature: "$toMillis(timestamp, picture?)", returns: "number", category: "DateTime",
    doc: "Parses timestamp string to epoch ms.",
    params: [{ name: "timestamp", type: "string" }, { name: "picture", type: "string", optional: true }] },

  // Higher-order
  { name: "map", signature: "$map(array, fn)", returns: "array", category: "HigherOrder",
    doc: "Applies `function($v, $i, $a)` to each element.",
    params: [{ name: "array", type: "array" }, { name: "fn", type: "function" }] },
  { name: "filter", signature: "$filter(array, predicate)", returns: "array", category: "HigherOrder",
    doc: "Keeps elements where predicate returns truthy.",
    params: [{ name: "array", type: "array" }, { name: "predicate", type: "function" }] },
  { name: "single", signature: "$single(array, predicate)", returns: "any", category: "HigherOrder",
    doc: "Returns the single matching element; errors if not exactly one matches.",
    params: [{ name: "array", type: "array" }, { name: "predicate", type: "function" }] },
  { name: "reduce", signature: "$reduce(array, fn, init?)", returns: "any", category: "HigherOrder",
    doc: "Reduces array using `function($acc, $v) { ... }`.",
    params: [{ name: "array", type: "array" }, { name: "fn", type: "function" }, { name: "init", type: "any", optional: true }] }
];

export const KEYWORDS = ["true", "false", "null", "function", "and", "or", "in"];
