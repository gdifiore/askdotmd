import * as vscode from "vscode";
import axios from "axios";

interface ModelConfig {
  apiUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  payload: (systemPrompt: string, content: string, config: any) => any;
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
    payload: (systemPrompt: string, content: string, config: any) => ({
      model: config.claudeModel || "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: `${systemPrompt}\n\n${content}` }],
      max_tokens: config.maxTokens || 1000,
    }),
    parseResponse: (response: any) => response.data.content[0].text,
  },
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    payload: (systemPrompt: string, content: string, config: any) => ({
      model: config.openaiModel || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: config.maxTokens || 1000,
      temperature: config.temperature !== undefined ? config.temperature : 0.7,
    }),
    parseResponse: (response: any) => response.data.choices[0].message.content,
  },
  lmstudio: {
    apiUrl: "http://localhost:1234/v1/chat/completions",
    headers: (apiKey: string) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
      return headers;
    },
    payload: (systemPrompt: string, content: string, config: any) => {
      const payload: any = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        temperature: config.temperature !== undefined ? config.temperature : 0.7,
        max_tokens: config.maxTokens || 1000,
      };
      if (config.lmstudioModel) {
        payload.model = config.lmstudioModel;
      }
      return payload;
    },
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

        // Add file context if enabled
        const config = vscode.workspace.getConfiguration("askdotmd");
        const showContextInfo = config.get<boolean>("showContextInfo");
        if (showContextInfo) {
          const fileName = document.fileName;
          const languageId = document.languageId;
          let contextInfo = `File: ${fileName}\nLanguage: ${languageId}`;

          if (!selection.isEmpty) {
            const startLine = selection.start.line + 1;
            const endLine = selection.end.line + 1;
            contextInfo += `\nLines: ${startLine}-${endLine}`;
          }

          contentToSend = `${contextInfo}\n\n${contentToSend}`;
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
    // Get configuration settings
    const vsConfig = vscode.workspace.getConfiguration("askdotmd");
    const userConfig = {
      maxTokens: vsConfig.get<number>("maxTokens") || 1000,
      temperature: vsConfig.get<number>("temperature") !== undefined
        ? vsConfig.get<number>("temperature")
        : 0.7,
      claudeModel: vsConfig.get<string>("claudeModel") || "claude-3-5-sonnet-20241022",
      openaiModel: vsConfig.get<string>("openaiModel") || "gpt-4o",
      lmstudioModel: vsConfig.get<string>("lmstudioModel") || "",
    };

    const payload = config.payload(SYSTEM_PROMPT, content, userConfig);
    const response = await axios.post(config.apiUrl, payload, {
      headers: config.headers(apiKey.trim()),
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
