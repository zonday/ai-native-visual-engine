import type { VisualDocument } from "../types.js";
import type { DocumentAction } from "./actions.js";

export function computeInverseAction(
  documentBefore: VisualDocument,
  action: DocumentAction,
): DocumentAction | undefined {
  switch (action.type) {
    case "create-page": {
      return {
        type: "remove-page",
        pageId: action.page.id,
      };
    }

    case "rename-page": {
      const page = documentBefore.pages.find((p) => p.id === action.pageId);
      if (!page) return undefined;
      return {
        type: "rename-page",
        pageId: action.pageId,
        name: page.name,
      };
    }

    case "remove-page": {
      const page = documentBefore.pages.find((p) => p.id === action.pageId);
      const scene = documentBefore.scenes[page?.sceneId ?? ""];
      if (!page || !scene) return undefined;
      return {
        type: "create-page",
        page: {
          id: page.id,
          name: page.name,
          sceneId: page.sceneId,
          route: page.route,
          themeId: page.themeId,
          metadata: page.metadata,
        },
        scene,
      };
    }

    case "reorder-page": {
      const idx = documentBefore.pages.findIndex((p) => p.id === action.pageId);
      if (idx === -1) return undefined;
      return {
        type: "reorder-page",
        pageId: action.pageId,
        index: idx,
      };
    }

    case "update-page-route": {
      const page = documentBefore.pages.find((p) => p.id === action.pageId);
      if (!page) return undefined;
      const route = page.route ?? "";
      return {
        type: "update-page-route",
        pageId: action.pageId,
        route,
      };
    }

    case "set-document-theme": {
      return {
        type: "set-document-theme",
        themeId: documentBefore.activeThemeId,
      };
    }

    case "set-page-theme": {
      const page = documentBefore.pages.find((p) => p.id === action.pageId);
      if (!page) return undefined;
      return {
        type: "set-page-theme",
        pageId: action.pageId,
        themeId: page.themeId,
      };
    }

    case "batch-document-actions": {
      const inverses: DocumentAction[] = [];
      for (let i = action.actions.length - 1; i >= 0; i--) {
        const childAction = action.actions[i] as DocumentAction;
        const inverse = computeInverseAction(documentBefore, childAction);
        if (!inverse) return undefined;
        inverses.push(inverse);
      }
      return {
        type: "batch-document-actions",
        actions: inverses,
      };
    }

    default:
      return undefined;
  }
}
