# askdotmd
 chatgpt in your vscode -- stop being distracted when you open up your browser and do LLM chat in your editor


## Features

- **Full File Context**: Send the entire file to an LLM when no text is selected, assuming the request is in a comment (e.g., `// Explain this function`).
- **Selected Text Context**: Send only the selected text to an LLM and replace the selection with the response.
- **Multiple LLM Support**: Choose from Claude, OpenAI, or LM Studio (local) models.
- **Customizable**: Configure API keys and default model via VS Code settings.

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

1. Open any code file in VS Code (e.g., `.js`, `.py`, `.md`).
2. Add a commented request, e.g., // Generate a sorting function or # Explain this code.
3. Trigger the askdotmd: Send Request command:
    - No Selection: Run the command to send the entire file to the LLM. The response is inserted at the cursor.
    - With Selection: Select text, then run the command to send only the selection. The response replaces the selected text.

4. Access the command via:

    - Command Palette (Ctrl+Shift+P): Search for askdotmd: Send Request.
    - Keybinding: Assign a key (e.g., Ctrl+Shift+L) in Keyboard Shortcuts (keybindings.json):
    ```json
      {
        "key": "ctrl+shift+l",
        "command": "askdotmd.sendRequest"
      }
      ```

5. Choose an LLM if no default is set (Claude, OpenAI, or LM Studio).

## Demo
[Streamable Link](https://streamable.com/advgvj)

## Limitations
- The extension assumes requests are embedded in comments but does not yet extract them automatically. Ensure your request is clear in the file or selection.
- Large files may exceed LLM token limits; consider selecting specific sections for such cases.
- API rate limits or quotas may apply depending on your LLM provider.
