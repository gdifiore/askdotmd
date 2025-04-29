import * as vscode from "vscode";
import axios from "axios";

interface ModelConfig {
  apiUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  payload: (systemPrompt: string, content: string) => any;
  parseResponse: (response: any) => string;
}

const SYSTEM_PROMPT = `You are a helpful and knowledgeable programming assistant. Your primary role is to assist developers by providing accurate and relevant information, answering their questions, and helping them solve programming challenges. You understand multiple programming languages and can provide code examples, explain complex concepts in a simple manner, and offer guidance on best practices. If a request is embedded in a comment, extract and respond to the commented instruction.`;

const modelConfigs: Record<string, ModelConfig> = {
  claude: {
    apiUrl: "https://api.anthropic.com/v1/messages",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
    payload: (systemPrompt: string, content: string) => ({
      model: "claude-3-sonnet-20240229",
      messages: [{ role: "user", content: `${systemPrompt}\n\n${content}` }],
      max_tokens: 1000,
    }),
    parseResponse: (response: any) => response.data.content[0].text,
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    payload: (systemPrompt: string, content: string) => ({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: 1000,
    }),
    parseResponse: (response: any) => response.data.choices[0].message.content,
  },
  lmstudio: {
    apiUrl: "http://localhost:1234/v1/chat/completions",
    headers: () => ({ "Content-Type": "application/json" }),
    payload: (systemPrompt: string, content: string) => ({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
    parseResponse: (response: any) => response.data.choices[0].message.content,
  },
};

export function activate(context: vscode.ExtensionContext) {
  const sendRequestCommand = vscode.commands.registerCommand(
    "askdotmd.sendRequest",
    async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active text editor found.");
          return;
        }

        const document = editor.document;
        const selection = editor.selection;
        let contentToSend = "";

        if (!selection.isEmpty) {
          // Use selected text if available
          contentToSend = document.getText(selection);
        } else {
          // Use entire file content if no selection
          contentToSend = document.getText();
        }

        if (!contentToSend.trim()) {
          vscode.window.showInformationMessage(
            "No content to send (empty file or selection)."
          );
          return;
        }

        const modelName = await selectModel();
        if (!modelName) return;

        const apiKey = vscode.workspace
          .getConfiguration("askdotmd")
          .get<string>(`${modelName}ApiKey`);
        if (!apiKey) {
          vscode.window.showErrorMessage(
            `API key for ${modelName} not configured. Please set it in settings.`
          );
          return;
        }

        const response = await sendRequest(modelName, contentToSend, apiKey);
        if (!response) return;

        // Insert or replace text
        await editor.edit((editBuilder) => {
          if (selection.isEmpty) {
            editBuilder.insert(selection.start, response);
          } else {
            editBuilder.replace(selection, response);
          }
        });

        // Update cursor position
        const responseLines = response.split("\n");
        const lastLineLength = responseLines[responseLines.length - 1].length;
        const newPosition = selection.isEmpty
          ? selection.start.translate(responseLines.length - 1, lastLineLength)
          : selection.start.translate(responseLines.length - 1, lastLineLength);
        editor.selection = new vscode.Selection(newPosition, newPosition);

        vscode.window.showInformationMessage(
          "Request sent successfully, and response added to the document."
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
      }
    }
  );

  context.subscriptions.push(sendRequestCommand);
}

async function selectModel(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration("askdotmd");
  const defaultModel = config.get<string>("defaultModel");
  const modelNames = Object.keys(modelConfigs);

  if (defaultModel && modelNames.includes(defaultModel)) {
    return defaultModel;
  }

  return vscode.window.showQuickPick(modelNames, {
    placeHolder: "Select a model",
  });
}

async function sendRequest(
  modelName: string,
  content: string,
  apiKey: string
): Promise<string | undefined> {
  const config = modelConfigs[modelName];
  if (!config) {
    vscode.window.showErrorMessage(`Invalid model: ${modelName}`);
    return undefined;
  }

  try {
    const payload = config.payload(SYSTEM_PROMPT, content);
    const response = await axios.post(config.apiUrl, payload, {
      headers: config.headers(apiKey),
    });
    return config.parseResponse(response);
  } catch (error) {
    vscode.window.showErrorMessage(
      `API request failed: ${(error as Error).message}`
    );
    return undefined;
  }
}

export function deactivate() {}
