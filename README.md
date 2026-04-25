# askdotmd

LLM chat directly in VS Code. No browser needed.

## Features

- Send entire file or selected text to an LLM
- Response inserted at cursor or replaces selection
- Supports Claude, OpenAI, and LM Studio (local)
- Configure API keys and models in VS Code settings

## Prerequisites

- **VS Code**
- **API Keys**: Obtain keys from [Anthropic](https://www.anthropic.com) for Claude or [OpenAI](https://platform.openai.com) for GPT models.
- **LM Studio**: For local LLM use, ensure [LM Studio](https://lmstudio.ai) is running on `http://localhost:1234`.
- **Node.js**: Required for building from source.

## Installation

### From VSIX
1. Download the `.vsix` file from the latest release.
2. Open VS Code, go to **Extensions** (`Ctrl+Shift+X`).
3. Click `...` > **Install from VSIX** and select the downloaded file.

### Build from Source
1. Clone the repository: `git clone https://github.com/gdifiore/askdotmd.git`.
2. Install dependencies: `npm ci`.
3. Build the extension: `npm run webpack`.
4. Package the extension: `npm run package`.
5. Install the generated `.vsix` file as above.

## Configuration

API keys are stored in VS Code's encrypted SecretStorage, not in `settings.json`.

Set a key via the Command Palette (`Ctrl+Shift+P`):
- `Ask.md: Set API Key` — choose a provider and enter the key
- `Ask.md: Clear API Key` — remove a stored key

On first request to a provider, you will be prompted for the key if none is stored.

Other settings (Command Palette → `Preferences: Open Settings`):

- `askdotmd.defaultModel`: Default LLM (`claude`, `openai`, or `lmstudio`).
- `askdotmd.claudeModel` / `askdotmd.openaiModel` / `askdotmd.lmstudioModel`: Model name.
- `askdotmd.lmstudioApiUrl`: LM Studio endpoint (default `http://localhost:1234/v1/chat/completions`).
- `askdotmd.maxTokens`: Max tokens per response (default `4096`).
- `askdotmd.temperature`: Sampling temperature (default `0.7`).
- `askdotmd.showContextInfo`: Prepend filename/language/lines to request (default `true`).

## Usage

1. Open a file in VS Code
2. Add a request in a comment (e.g., `// Generate a sorting function`)
3. Trigger the command:
   - **No selection**: Sends entire file, inserts response at cursor
   - **With selection**: Sends only selection, replaces with response

**Access the command:**
- Command Palette (`Ctrl+Shift+P`): `askdotmd: Send Request`
- Default keybinding: `Ctrl+Shift+L` (Mac: `Cmd+Shift+L`)

Select your LLM when prompted (Claude, OpenAI, or LM Studio).

## Demo
[Streamable Link](https://streamable.com/advgvj)

## Limitations
- Requests should be in comments; automatic extraction not yet implemented
- Large files may exceed token limits (select specific sections instead)
- Subject to your LLM provider's rate limits and quotas
