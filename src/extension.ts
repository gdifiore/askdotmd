import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

export function activate(context: vscode.ExtensionContext) {
  const sendRequestCommand = vscode.commands.registerCommand(
    "extension.sendRequest",
    async () => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const askFilePath = workspaceFolder
        ? path.join(workspaceFolder, "ask.md")
        : undefined;

      if (!askFilePath) {
        vscode.window.showErrorMessage(
          'The "ask.md" file does not exist in the current project directory.'
        );
        return;
      }

      try {
        const askContent = fs.readFileSync(askFilePath, "utf-8");

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a programming assistant, tasked with assisting, guiding, and supporting developers.',
            },
            {
              role: 'user',
              content: askContent,
            },
          ],
        })
        .then(response => {
          fs.appendFileSync(askFilePath, `\n\n${response.choices[0].message.content}`, "utf-8");
          vscode.window.showInformationMessage(
            'Request sent successfully, and response appended to "ask.md".'
          );
        })
        .catch(error => {
          vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
      }
    }
  );

  context.subscriptions.push(sendRequestCommand);
}

export function deactivate() {}
