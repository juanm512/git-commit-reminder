import * as vscode from "vscode";
import { exec } from "node:child_process";

let timer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
	const startReminder = vscode.commands.registerCommand(
		"extension.startGitReminder",
		() => {
			const intervalMinutes = getConfiguredInterval();
			const interval = intervalMinutes * 60 * 1000; // Convert minutes to milliseconds

			if (timer) {
				clearInterval(timer);
			}

			timer = setInterval(() => {
				checkGitStatus();
			}, interval);

			vscode.window.showInformationMessage(
				`Git commit reminder started! Interval: ${intervalMinutes} minutes`,
			);
		},
	);

	const stopReminder = vscode.commands.registerCommand(
		"extension.stopGitReminder",
		() => {
			if (timer) {
				clearInterval(timer);
				timer = undefined;
				vscode.window.showInformationMessage("Git commit reminder stopped.");
			}
		},
	);

	const updateInterval = vscode.commands.registerCommand(
		"extension.updateGitReminderInterval",
		async () => {
			const result = await vscode.window.showInputBox({
				prompt: "Enter new reminder interval (in minutes)",
				validateInput: (value) => {
					const num = Number.parseInt(value);
					return Number.isNaN(num) || num <= 0
						? "Please enter a positive number"
						: null;
				},
			});

			if (result) {
				const newInterval = Number.parseInt(result);
				const config = vscode.workspace.getConfiguration("gitReminder");
				await config.update(
					"reminderInterval",
					newInterval,
					vscode.ConfigurationTarget.Global,
				);

				vscode.window.showInformationMessage(
					`Git commit reminder interval updated to ${newInterval} minutes`,
				);

				// Restart the timer with the new interval
				vscode.commands.executeCommand("extension.startGitReminder");
			}
		},
	);

	context.subscriptions.push(startReminder, stopReminder, updateInterval);
}

export function deactivate() {
	if (timer) {
		clearInterval(timer);
	}
}

function getConfiguredInterval(): number {
	const config = vscode.workspace.getConfiguration("gitReminder");
	return config.get("reminderInterval", 30);
}

function checkGitStatus() {
	const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

	if (!rootPath) {
		return;
	}

	exec("git status --porcelain", { cwd: rootPath }, (error, stdout, stderr) => {
		if (error) {
			console.error(`Error: ${error.message}`);
			return;
		}
		if (stderr) {
			console.error(`stderr: ${stderr}`);
			return;
		}
		if (stdout) {
			showCommitReminder();
		}
	});
}

async function showCommitReminder() {
	const selection = await vscode.window.showWarningMessage(
		"You have uncommitted changes. Consider making a commit!",
		"Commit now",
		"Remind me later",
		"Stop reminders",
	);

	switch (selection) {
		case "Commit now": {
			const gitExtension = vscode.extensions.getExtension("vscode.git");
			if (gitExtension?.isActive) {
				// If the Git extension is active, focus on the Source Control view
				await vscode.commands.executeCommand("workbench.view.scm");
			} else {
				// If the Git extension is not active, use the default git.commit command
				await vscode.commands.executeCommand("git.commit");
			}
			break;
		}
		case "Remind me later":
			// Do nothing, the timer will trigger again later
			break;
		case "Stop reminders":
			vscode.commands.executeCommand("extension.stopGitReminder");
			break;
	}
}
