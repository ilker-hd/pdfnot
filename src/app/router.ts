import { renderLibraryView } from "../views/libraryView";
import { openDocumentView } from "../views/documentView";

export function startRouter(root: HTMLElement): void {
  const render = () => {
    const hash = window.location.hash;
    const docMatch = hash.match(/^#\/doc\/(.+)$/);
    if (docMatch) {
      openDocumentView(root, decodeURIComponent(docMatch[1]), () => {
        window.location.hash = "#/library";
      });
    } else {
      renderLibraryView(root, (id) => {
        window.location.hash = `#/doc/${encodeURIComponent(id)}`;
      });
    }
  };

  window.addEventListener("hashchange", render);
  if (!window.location.hash) window.location.hash = "#/library";
  else render();
}
