# Aqua Syntax Highlighting

The tool enables syntax highlighting for [Aqua](https://github.com/fluencelabs/aqua) programming language, compilation on file changes, and go-to definition in Visual Studio.


## Installation and Usage

Installation is pretty simple:

1. Install [the extension](https://marketplace.visualstudio.com/items?itemName=FluenceLabs.aqua).

2. Configure colors for Aqua-specific tokens if needed (see below).

    Add the following lines to the [`settings.json`](https://code.visualstudio.com/docs/getstarted/settings) file. Feel free to choose colors according to your favorite theme. In the example below, services will be highlighted as green and all keywords that affect the topology will be highlighted as red.

    ```json
        "editor.tokenColorCustomizations": {
            "textMateRules": [
                {
                    "scope": "keyword.topology.aqua",
                    "settings": {
                        "foreground": "#FF0000",
                    }
                },
                {
                    "scope": "support.service.aqua",
                    "settings": {
                        "foreground": "#00FF00",
                    }
                }
            ]
        }
    ```

More details can be found [here](vsc-extension-quickstart.md).

NOTE: if you're going to change pattern names, check out the naming rules in [TextMate Grammar doc](https://macromates.com/manual/en/language_grammars). You have to use the predefined pattern naming scheme, or the syntax won't be highlighted.


## Support

Please, file an [issue](https://github.com/fluencelabs/aqua-vscode/issues) if you find a bug. You can also contact us at [Discord](https://discord.com/invite/5qSnPZKh7u) or [Telegram](https://t.me/fluence_project).  We will do our best to resolve the issue ASAP.


## Contributing

Any interested person is welcome to contribute to the project. Please, make sure you read and follow some basic [rules](./CONTRIBUTING.md).


## License

All software code is copyright (c) Fluence Labs, Inc. under the [Apache-2.0](./LICENSE) license.

