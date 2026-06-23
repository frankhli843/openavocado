"use client";

/**
 * PythonEditor — CodeMirror-backed Python editor.
 *
 * Extracted as a separate component so it can be dynamically imported
 * (ssr: false) from PythonSection.tsx without pulling CodeMirror into
 * the server bundle.
 *
 * Features:
 * - Python syntax highlighting (@codemirror/lang-python)
 * - One Dark theme (@codemirror/theme-one-dark / re-exported by @uiw/react-codemirror)
 * - Auto-indentation (built into CodeMirror's Python extension)
 * - Bracket/paren matching and closing
 * - Tab = 4 spaces (Python convention, via custom keymap)
 * - Accessible: aria-label on the editor root
 *
 * Only imports from directly installed deps:
 *   @codemirror/lang-python, @uiw/react-codemirror (re-exports EditorView, keymap, Prec, oneDark)
 */

import CodeMirror, { keymap, EditorView, Prec, oneDark } from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";

interface PythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  fullscreen?: boolean;
}

// Tab → insert 4 spaces (Python convention). Shift-Tab falls through to CM default de-indent.
const pythonTabKeymap = Prec.highest(
  keymap.of([
    {
      key: "Tab",
      run(view) {
        const { from, to } = view.state.selection.main;
        const insert = "    "; // 4 spaces
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
        return true;
      },
    },
  ])
);

// Soft-wrap so no horizontal scroll at 390px mobile width.
const softWrap = EditorView.lineWrapping;

const PYTHON_EXTENSIONS = [
  python(),
  oneDark,
  pythonTabKeymap,
  softWrap,
];

export default function PythonEditor({
  value,
  onChange,
  height = "208px",
  fullscreen = false,
}: PythonEditorProps) {
  return (
    <CodeMirror
      value={value}
      height={fullscreen ? "100%" : height}
      extensions={PYTHON_EXTENSIONS}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        dropCursor: false,
        allowMultipleSelections: false,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        rectangularSelection: false,
        crosshairCursor: false,
        highlightActiveLine: true,
        highlightSelectionMatches: false,
        tabSize: 4,
      }}
      className="text-sm font-mono"
      aria-label="Python code editor"
      style={{ height: fullscreen ? "100%" : height }}
    />
  );
}
