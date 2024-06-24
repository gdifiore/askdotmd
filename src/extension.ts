import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

interface ModelConfig {
  apiUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  payload: (systemPrompt: string, content: string) => any;
}

const SYSTEM_PROMPT = `You are a helpful and knowledgeable programming assistant. Your primary role is to assist developers by providing accurate and relevant information, answering their questions, and helping them solve programming challenges. You understand multiple programming languages and can provide code examples, explain complex concepts in a simple manner, and offer guidance on best practices.`;

interface ModelConfig {
  apiUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  payload: (systemPrompt: string, content: string) => any;
}

const modelConfigs: Record<string, ModelConfig> = {
  claude: {
    apiUrl: "https://api.anthropic.com/v1/chat/completions",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    }),
    payload: (systemPrompt: string, content: string) => ({
      model: "claude-3-sonnet-20240229",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content }
      ],
      max_tokens: 1000,
    }),
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    }),
    payload: (systemPrompt: string, content: string) => ({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content }
      ],
      max_tokens: 1000,
    }),
  },
  lmstudio: {
    apiUrl: "http://localhost:1234/v1/chat/completions",
    headers: () => ({ "Content-Type": "application/json" }),
    payload: (systemPrompt: string, content: string) => ({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  },
};

// Store the last content of the document
let lastContent = "";

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
        const currentContent = document.getText();

        // Compute the difference
        const newContent = currentContent.substring(lastContent.length);

        const modelName = await selectModel();
        if (!modelName) return;

        const response = await sendRequest(modelName, newContent);
        if (!response) return;

        // Replace the selection or insert at cursor
        const selection = editor.selection;
        await editor.edit(editBuilder => {
          if (selection.isEmpty) {
            editBuilder.insert(selection.start, response);
          } else {
            editBuilder.replace(selection, response);
          }
        });

        // Move cursor to end of inserted/replaced text
        const newPosition = selection.start.translate(0, response.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);

        vscode.window.showInformationMessage(
          'Request sent successfully, and response added to the document.'
        );

        // Update the last content
        lastContent = currentContent;
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

async function sendRequest(modelName: string, content: string): Promise<string | undefined> {
  const config = modelConfigs[modelName];
  if (!config) {
    vscode.window.showErrorMessage(`Invalid model: ${modelName}`);
    return undefined;
  }

  const askdotmdConfig = vscode.workspace.getConfiguration("askdotmd");
  const apiKey = askdotmdConfig.get<string>(`${modelName}ApiKey`) || "";

  try {
    const payload = config.payload(SYSTEM_PROMPT, content);
    const response = await axios.post(config.apiUrl, payload, {
      headers: config.headers(apiKey),
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    vscode.window.showErrorMessage(`API request failed: ${(error as Error).message}`);
    return undefined;
  }
}

export function deactivate() {}
