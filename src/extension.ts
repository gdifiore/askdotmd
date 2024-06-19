import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

export function activate(context: vscode.ExtensionContext) {
  const sendRequestCommand = vscode.commands.registerCommand(
    "askdotmd.sendRequest",
    async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const askFilePath = workspaceFolder ? path.join(workspaceFolder, "ask.md") : undefined;

      if (!askFilePath) {
        vscode.window.showErrorMessage(
          'The "ask.md" file does not exist in the current project directory.'
        );
        return;
      }

      try {
        if (!fs.existsSync(askFilePath)) {
          vscode.window.showErrorMessage('The "ask.md" file does not exist.');
          return;
        }

        const askContent = fs.readFileSync(askFilePath, "utf-8");
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
          vscode.window.showErrorMessage('OPENAI_API_KEY is not set.');
          return;
        }

        const openai = new OpenAI({ apiKey });

        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful and knowledgeable programming assistant. Your primary role is to assist developers by providing accurate and relevant information, answering their questions, and helping them solve programming challenges. You understand multiple programming languages and can provide code examples, explain complex concepts in a simple manner, and offer guidance on best practices.',
            },
            {
              role: 'user',
              content: askContent,
            },
          ],
        });

        fs.appendFileSync(askFilePath, `\n\n${response.choices[0].message.content}`, "utf-8");
        vscode.window.showInformationMessage(
          'Request sent successfully, and response appended to "ask.md".'
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
      }
    }
  );

  context.subscriptions.push(sendRequestCommand);
}

export function deactivate() {}
