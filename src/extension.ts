import * as vscode from "vscode";
import axios from "axios";

interface ModelConfig {
  apiUrl: string;
  headers: (apiKey: string) => Record<string, string>;
  payload: (systemPrompt: string, content: string) => any;
}

const SYSTEM_PROMPT = `You are a helpful and knowledgeable programming assistant. Your primary role is to assist developers by providing accurate and relevant information, answering their questions, and helping them solve programming challenges. You understand multiple programming languages and can provide code examples, explain complex concepts in a simple manner, and offer guidance on best practices.`;

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

let changeLog = "";

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

        let contentToSend = "";
        const selection = editor.selection;

        if (!selection.isEmpty) {
          // If there's selected text, use that
          contentToSend = editor.document.getText(selection);
          console.log("Selected text to send:", contentToSend);
        } else {
          // Otherwise, use the changeLog
          contentToSend = changeLog.trim();
          console.log("Change log to send:", contentToSend);
        }

        // If there's no new content to send, show a message and return
        if (!contentToSend) {
          vscode.window.showInformationMessage("No new changes or selection to send.");
          console.log("No new content detected");
          return;
        }

        const modelName = await selectModel();
        if (!modelName) return;

        const response = await sendRequest(modelName, contentToSend);
        if (!response) return;

        // Clear the changeLog after sending
        changeLog = "";

        // Insert the response
        await editor.edit(editBuilder => {
          if (selection.isEmpty) {
            // Insert response at the cursor if no text is selected
            editBuilder.insert(selection.start, response);
          } else {
            // Replace the selected text with the response
            editBuilder.replace(selection, response);
          }
        });

        // Update the cursor position to the end of the inserted/replaced text
        const newPosition = selection.isEmpty
          ? selection.start.translate(0, response.length)
          : selection.start.translate(
              0,
              response.split("\n").pop()?.length || response.length
            );
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

  // Track changes in the active text editor's document
  vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document === vscode.window.activeTextEditor?.document) {
      for (const change of event.contentChanges) {
        changeLog += change.text;
      }
      console.log("Current change log:", changeLog);
    }
  });

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
