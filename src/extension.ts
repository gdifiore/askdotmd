import * as path from "path";
import * as vscode from "vscode";
import axios, { AxiosRequestConfig } from "axios";

type ModelName = "claude" | "openai" | "lmstudio";

interface UserConfig {
  maxTokens: number;
  temperature: number;
  claudeModel: string;
  openaiModel: string;
  lmstudioModel: string;
  lmstudioApiUrl: string;
}

interface ModelConfig {
  apiUrl: (cfg: UserConfig) => string;
  headers: (apiKey: string) => Record<string, string>;
  payload: (systemPrompt: string, content: string, cfg: UserConfig) => unknown;
  parseResponse: (data: unknown, modelName: string) => string;
  requiresApiKey: boolean;
}

const SYSTEM_PROMPT = `Provide clear, accurate programming assistance. When code contains comments with requests or questions, extract and respond to those instructions.`;

const SECRET_KEY = (model: ModelName) => `askdotmd.${model}.apiKey`;

const modelConfigs: Record<ModelName, ModelConfig> = {
  claude: {
    apiUrl: () => "https://api.anthropic.com/v1/messages",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
    payload: (systemPrompt, content, cfg) => ({
      model: cfg.claudeModel,
      system: systemPrompt,
      messages: [{ role: "user", content }],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
    }),
    parseResponse: (data, modelName) => {
      const text = (data as any)?.content?.[0]?.text;
      if (typeof text !== "string") {
        throw new Error(`Unexpected API response format from ${modelName}`);
      }
      return text;
    },
    requiresApiKey: true,
  },
  openai: {
    apiUrl: () => "https://api.openai.com/v1/chat/completions",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    payload: (systemPrompt, content, cfg) => ({
      model: cfg.openaiModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      max_tokens: cfg.maxTokens,
      temperature: cfg.temperature,
    }),
    parseResponse: (data, modelName) => {
      const text = (data as any)?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error(`Unexpected API response format from ${modelName}`);
      }
      return text;
    },
    requiresApiKey: true,
  },
  lmstudio: {
    apiUrl: (cfg) => cfg.lmstudioApiUrl,
    headers: (apiKey) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      return headers;
    },
    payload: (systemPrompt, content, cfg) => {
      const body: Record<string, unknown> = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
      };
      if (cfg.lmstudioModel) body.model = cfg.lmstudioModel;
      return body;
    },
    parseResponse: (data, modelName) => {
      const text = (data as any)?.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new Error(`Unexpected API response format from ${modelName}`);
      }
      return text;
    },
    requiresApiKey: false,
  },
};

const MODEL_NAMES = Object.keys(modelConfigs) as ModelName[];

function isModelName(value: string): value is ModelName {
  return (MODEL_NAMES as string[]).includes(value);
}

function readUserConfig(): UserConfig {
  const c = vscode.workspace.getConfiguration("askdotmd");
  return {
    maxTokens: c.get<number>("maxTokens") ?? 4096,
    temperature: c.get<number>("temperature") ?? 0.7,
    claudeModel: c.get<string>("claudeModel") || "claude-3-5-sonnet-20241022",
    openaiModel: c.get<string>("openaiModel") || "gpt-4o",
    lmstudioModel: c.get<string>("lmstudioModel") || "",
    lmstudioApiUrl:
      c.get<string>("lmstudioApiUrl") || "http://localhost:1234/v1/chat/completions",
  };
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("askdotmd.sendRequest", () =>
      sendRequestCommand(context)
    ),
    vscode.commands.registerCommand("askdotmd.setApiKey", () =>
      setApiKeyCommand(context)
    ),
    vscode.commands.registerCommand("askdotmd.clearApiKey", () =>
      clearApiKeyCommand(context)
    )
  );
}

export function deactivate() {}

async function sendRequestCommand(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found.");
    return;
  }

  const document = editor.document;
  const selection = editor.selection;
  let contentToSend = selection.isEmpty
    ? document.getText()
    : document.getText(selection);

  if (!contentToSend.trim()) {
    vscode.window.showInformationMessage(
      "No content to send (empty file or selection)."
    );
    return;
  }

  const vsConfig = vscode.workspace.getConfiguration("askdotmd");
  if (vsConfig.get<boolean>("showContextInfo")) {
    const fileName = path.basename(document.fileName);
    let contextInfo = `File: ${fileName}\nLanguage: ${document.languageId}`;
    if (!selection.isEmpty) {
      contextInfo += `\nLines: ${selection.start.line + 1}-${selection.end.line + 1}`;
    }
    contentToSend = `${contextInfo}\n\n${contentToSend}`;
  }

  const modelName = await selectModel();
  if (!modelName) return;

  const modelCfg = modelConfigs[modelName];
  let apiKey = await context.secrets.get(SECRET_KEY(modelName));
  if (modelCfg.requiresApiKey && !apiKey) {
    apiKey = await promptForApiKey(context, modelName);
    if (!apiKey) return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Asking ${modelName}...`,
      cancellable: true,
    },
    async (_progress, token) => {
      const response = await sendRequest(modelName, contentToSend, apiKey ?? "", token);
      if (!response || !response.trim()) {
        if (response !== undefined) {
          vscode.window.showErrorMessage("API returned empty response.");
        }
        return;
      }

      const currentEditor = vscode.window.activeTextEditor;
      if (!currentEditor || currentEditor.document !== document) {
        vscode.window.showWarningMessage(
          "Editor changed during request. Response not inserted."
        );
        return;
      }

      const start = selection.start;
      const ok = await currentEditor.edit((eb) => {
        if (selection.isEmpty) {
          eb.insert(start, response);
        } else {
          eb.replace(selection, response);
        }
      });
      if (!ok) return;

      const lines = response.split(/\r?\n/);
      const lastLineLen = lines[lines.length - 1].length;
      const endLine = start.line + lines.length - 1;
      const endChar = lines.length === 1 ? start.character + lastLineLen : lastLineLen;
      const newPos = new vscode.Position(endLine, endChar);
      currentEditor.selection = new vscode.Selection(newPos, newPos);
    }
  );
}

async function selectModel(): Promise<ModelName | undefined> {
  const config = vscode.workspace.getConfiguration("askdotmd");
  const defaultModel = config.get<string>("defaultModel");
  if (defaultModel && isModelName(defaultModel)) return defaultModel;

  const picked = await vscode.window.showQuickPick(MODEL_NAMES, {
    placeHolder: "Select a model",
  });
  return picked && isModelName(picked) ? picked : undefined;
}

async function promptForApiKey(
  context: vscode.ExtensionContext,
  modelName: ModelName
): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    prompt: `Enter API key for ${modelName}`,
    password: true,
    ignoreFocusOut: true,
  });
  if (!value) return undefined;
  await context.secrets.store(SECRET_KEY(modelName), value);
  return value;
}

async function setApiKeyCommand(context: vscode.ExtensionContext) {
  const modelName = await vscode.window.showQuickPick(MODEL_NAMES, {
    placeHolder: "Select model to set API key for",
  });
  if (!modelName || !isModelName(modelName)) return;
  const value = await vscode.window.showInputBox({
    prompt: `Enter API key for ${modelName} (stored in VS Code SecretStorage)`,
    password: true,
    ignoreFocusOut: true,
  });
  if (!value) return;
  await context.secrets.store(SECRET_KEY(modelName), value);
  vscode.window.showInformationMessage(`API key saved for ${modelName}.`);
}

async function clearApiKeyCommand(context: vscode.ExtensionContext) {
  const modelName = await vscode.window.showQuickPick(MODEL_NAMES, {
    placeHolder: "Select model to clear API key for",
  });
  if (!modelName || !isModelName(modelName)) return;
  await context.secrets.delete(SECRET_KEY(modelName));
  vscode.window.showInformationMessage(`API key cleared for ${modelName}.`);
}

async function sendRequest(
  modelName: ModelName,
  content: string,
  apiKey: string,
  token: vscode.CancellationToken
): Promise<string | undefined> {
  const userCfg = readUserConfig();
  const modelCfg = modelConfigs[modelName];

  const controller = new AbortController();
  const cancelSub = token.onCancellationRequested(() => controller.abort());

  const requestCfg: AxiosRequestConfig = {
    headers: modelCfg.headers(apiKey.trim()),
    timeout: 60000,
    signal: controller.signal,
  };

  try {
    const response = await axios.post(
      modelCfg.apiUrl(userCfg),
      modelCfg.payload(SYSTEM_PROMPT, content, userCfg),
      requestCfg
    );
    return modelCfg.parseResponse(response.data, modelName);
  } catch (error) {
    if (token.isCancellationRequested) return undefined;
    vscode.window.showErrorMessage(formatError(error));
    return undefined;
  } finally {
    cancelSub.dispose();
  }
}

function formatError(error: unknown): string {
  if (axios.isCancel(error)) return "Request cancelled.";
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const apiMsg =
        (error.response.data as any)?.error?.message ||
        (error.response.data as any)?.message;
      switch (status) {
        case 401:
          return "Invalid API key. Run 'Ask.md: Set API Key' to update.";
        case 429:
          return "Rate limit exceeded. Try again later.";
        case 500:
        case 502:
        case 503:
          return "Server error. The API service may be temporarily unavailable.";
        default:
          return `API error (${status})${apiMsg ? `: ${apiMsg}` : ""}`;
      }
    }
    if (error.request) {
      return "Cannot reach API. Check your internet connection.";
    }
    return `Request setup failed: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return "Unknown error";
}
