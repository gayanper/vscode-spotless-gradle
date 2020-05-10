import * as vscode from 'vscode';
import { logger } from './logger';
import { makeSpotless, cancelMakeSpotless } from './spotless';
import { FormattingProvider } from './FormattingProvider';

export class FixAllCodeActionProvider extends FormattingProvider
  implements vscode.CodeActionProvider {
  public static readonly fixAllCodeActionKind = vscode.CodeActionKind.SourceFixAll.append(
    'spotlessGradle'
  );

  public static metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [FixAllCodeActionProvider.fixAllCodeActionKind],
  };

  public async provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    if (!context.only) {
      return [];
    }

    if (
      !context.only.contains(FixAllCodeActionProvider.fixAllCodeActionKind) &&
      !FixAllCodeActionProvider.fixAllCodeActionKind.contains(context.only)
    ) {
      return [];
    }

    token.onCancellationRequested(() => {
      logger.warning('Spotless formatting cancelled');
      cancelMakeSpotless(this.gradleApi, document);
      this._onCancelled.fire(null);
    });

    try {
      const newText = await makeSpotless(this.gradleApi, document);
      if (!newText || token.isCancellationRequested) {
        return [];
      }
      const range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      const title = 'Format code using Spotless';
      const action = new vscode.CodeAction(
        title,
        FixAllCodeActionProvider.fixAllCodeActionKind
      );
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(document.uri, range, newText);
      action.isPreferred = true;

      return [action];
    } catch (e) {
      logger.error('Unable to apply code action:', e.message);
      return [];
    }
  }
}
