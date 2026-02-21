# thirdwatch-language-YOURNAME

A Thirdwatch language analyzer plugin for **YOURLANGUAGE**.

## Installation

```bash
npm install thirdwatch-language-YOURNAME
# or
pnpm add thirdwatch-language-YOURNAME
```

## Usage

Thirdwatch auto-discovers plugins with the `thirdwatch-plugin` keyword in their `package.json`.
Install the plugin alongside `thirdwatch` and it will be picked up automatically.

```bash
thirdwatch scan ./src
```

## Development

See [docs/contributing/adding-language-analyzer.md](../../docs/contributing/adding-language-analyzer.md) for a full guide.

```bash
pnpm install
pnpm build
pnpm test
```

## License

Apache-2.0
