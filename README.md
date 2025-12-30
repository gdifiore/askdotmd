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
1. Clone the repository: `git clone https://github.com/your-repo.git`.
2. Install dependencies: `npm install`.
3. Build the extension: `npm run webpack`.
4. Package the extension: `npm run package`.
5. Install the generated `.vsix` file as above.

## Configuration

Set your preferred LLM provider and API keys in VS Code settings (`File > Preferences > Settings` or `Ctrl+,`):

- `askdotmd.defaultModel`: Default LLM (`claude`, `openai`, or `lmstudio`).
- `askdotmd.claudeApiKey`: Anthropic API key for Claude.
- `askdotmd.openaiApiKey`: OpenAI API key for GPT models.
- `askdotmd.lmstudioApiKey`: (Optional) API key for LM Studio.

Example `settings.json`:
```json
{
  "askdotmd.defaultModel": "openai",
  "askdotmd.openaiApiKey": "your-openai-api-key",
  "askdotmd.claudeApiKey": "your-anthropic-api-key"
}
```

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
