"""Reapply the packaged watch-tab fix after installing pinned dependencies."""
import ast
from pathlib import Path


def main():
    target = Path(__file__).resolve().parents[1] / 'py_modules/ytmusicapi/parsers/watch.py'
    source = target.read_text(encoding='utf-8')
    function = next(node for node in ast.parse(source).body
                    if isinstance(node, ast.FunctionDef) and node.name == 'get_tab_browse_id')
    replacement = '''def get_tab_browse_id(watchNextRenderer: JsonDict, tab_id: int) -> str | None:
    # YouTube can omit optional lyrics/related tabs or their endpoints.
    tabs = watchNextRenderer.get("tabs") or []
    if tab_id < 0 or tab_id >= len(tabs):
        return None
    tab = tabs[tab_id].get("tabRenderer") or {}
    if tab.get("unselectable"):
        return None
    endpoint = tab.get("endpoint") or tab.get("navigationEndpoint") or {}
    browse_id = (endpoint.get("browseEndpoint") or {}).get("browseId")
    return browse_id if isinstance(browse_id, str) else None
'''
    lines = source.splitlines(keepends=True)
    updated = ''.join(lines[:function.lineno - 1]) + replacement + ''.join(lines[function.end_lineno:])
    ast.parse(updated)
    if updated != source:
        target.write_text(updated, encoding='utf-8')
    print('ytmusicapi watch-tab compatibility patch applied')


if __name__ == '__main__':
    main()
