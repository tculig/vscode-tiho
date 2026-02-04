import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';
import { css, spacing } from '@mongodb-js/compass-components';

interface MonacoViewerProps {
  document: Record<string, unknown>;
  /** Whether to truncate long string values. Defaults to true. */
  truncateValues?: boolean;
}

// Line height in pixels for Monaco editor
const LINE_HEIGHT = 19;
// Padding top and bottom for the editor
const EDITOR_PADDING = 0;
// Maximum height for the editor (prevents huge documents from taking over)
const MAX_EDITOR_HEIGHT = Infinity;

const cardStyles = css({
  backgroundColor:
    'var(--vscode-editorWidget-background, var(--vscode-editor-background))',
  border:
    '1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(255, 255, 255, 0.12)))',
  borderRadius: '6px',
  overflow: 'hidden',
  marginBottom: spacing[200],
  paddingTop: spacing[200],
});

const monacoWrapperStyles = css({
  paddingLeft: "10px",

  // Hide line numbers and glyph margin, but keep folding controls visible
  '& .monaco-editor .line-numbers': {
    display: 'none !important',
  },

  '& .monaco-editor .glyph-margin': {
    display: 'none !important',
  },

  // Remove any borders on the editor
  '& .monaco-editor': {
    border: 'none !important',
  },

  '& .monaco-editor .overflow-guard': {
    border: 'none !important',
  },

  '& .monaco-editor .monaco-scrollable-element': {
    border: 'none !important',
    boxShadow: 'none !important',
  },
  // Hide Monaco's internal textarea elements that appear as white boxes
  '& .monaco-editor .native-edit-context': {
    position: 'absolute',
    top: '0 !important',
    left: '0 !important',
    width: '0 !important',
    height: '0 !important',
    overflow: 'hidden !important',
    margin: '0 !important',
    padding: '0 !important',
    border: '0 !important',
  },

  '& .monaco-editor textarea.ime-text-area': {
    position: 'absolute',
    top: '0 !important',
    left: '0 !important',
    width: '1px !important',
    height: '1px !important',
    margin: '0 !important',
    padding: '0 !important',
    border: '0 !important',
    outline: 'none !important',
    boxShadow: 'none !important',
    opacity: '0 !important',
    background: 'transparent !important',
    color: 'transparent !important',
    lineHeight: '1px !important',
    resize: 'none',
  },
});

const showMoreButtonStyles = css({
  color: 'var(--vscode-textLink-foreground, #3794ff)',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
  '&:hover': {
    textDecoration: 'underline',
  },
  '&::before': {
    content: '"▸"',
    display: 'inline-block',
    transition: 'transform 0.2s',
  },
  '&[data-expanded="false"]::before': {
    transform: 'rotate(90deg)',
  },
});

const contextMenuStyles = css({
  position: 'fixed',
  backgroundColor: 'var(--vscode-menu-background, #252526)',
  border: '1px solid var(--vscode-menu-border, #454545)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  borderRadius: '4px',
  padding: '4px 0',
  minWidth: '150px',
  zIndex: 10000,
});

const contextMenuItemStyles = css({
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '13px',
  color: 'var(--vscode-menu-foreground, #cccccc)',
  backgroundColor: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  display: 'block',
  '&:hover': {
    backgroundColor: 'var(--vscode-menu-selectionBackground, #094771)',
    color: 'var(--vscode-menu-selectionForeground, #ffffff)',
  },
});

const viewerOptions: Monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  domReadOnly: false, // Allow DOM interactions like copy
  contextmenu: false,
  minimap: { enabled: false },
  glyphMargin: false,
  folding: true,
  foldingStrategy: 'indentation', // Better folding for object/array structures
  showFoldingControls: 'always',
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: 'hidden',
    horizontal: 'hidden',
    alwaysConsumeMouseWheel: false,
  },
  wordWrap: 'off',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: EDITOR_PADDING, bottom: EDITOR_PADDING },
  lineNumbers: 'off',
  cursorStyle: 'line',
  occurrencesHighlight: 'off',
  selectionHighlight: true,
  renderValidationDecorations: 'off',
  lineHeight: LINE_HEIGHT,
  fontFamily: 'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)',
  fontSize: 13,
  // Completely disable all decorations and margins
  renderLineHighlightOnlyWhenFocus: false,
  renderWhitespace: 'none',
  guides: {
    indentation: false,
    highlightActiveIndentation: false,
  },
  // Disable find widget (Ctrl+F)
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: 'never',
    seedSearchStringFromSelection: 'never',
  },
  // Disable the fold inline preview that shows collapsed content next to the fold arrow
  unfoldOnClickAfterEndOfLine: false,
  // Disable sticky scroll which can show content from folded regions
  stickyScroll: {
    enabled: false,
  },
};

// Maximum length for string values before truncation
const MAX_VALUE_LENGTH = 70;
// Maximum number of top-level fields to show initially
const MAX_INITIAL_FIELDS = 25;

/**
 * Slice document to only include the first N top-level fields
 */
function sliceDocumentFields(obj: Record<string, unknown>, maxFields: number): Record<string, unknown> {
  const entries = Object.entries(obj);
  if (entries.length <= maxFields) {
    return obj;
  }

  const slicedEntries = entries.slice(0, maxFields);
  return Object.fromEntries(slicedEntries);
}

/**
 * Recursively truncate long string values in an object
 */
function truncateLongValues(obj: any): any {
  if (typeof obj === 'string') {
    if (obj.length > MAX_VALUE_LENGTH) {
      return obj.substring(0, MAX_VALUE_LENGTH) + '...';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => truncateLongValues(item));
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateLongValues(value);
    }
    return result;
  }

  return obj;
}

/**
 * Format a string value, handling multi-line strings with proper indentation
 * Multi-line strings use template literals (backticks) for proper JS syntax highlighting
 */
function formatStringValue(str: string, indent: number): string {
  // Check if string contains newlines - use template literals for multi-line
  if (str.includes('\n') || str.includes('\r')) {
    // For template literals, escape backticks and ${
    const escaped = str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

    // Multi-line string: format with continuation lines indented
    const continuationIndent = '  '.repeat(indent) + '   ';
    const lines = escaped.split(/\r?\n/);

    const formattedLines = lines.map((line, index) => {
      if (index === 0) {
        return '`' + line;
      }
      return `${continuationIndent}${line}`;
    });

    return formattedLines.join('\n') + '`';
  }

  // Single-line string: use double quotes
  const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/**
 * Format JSON-like data into JavaScript object notation (unquoted keys).
 * Note: root-level tokenization quirks are handled separately by the editor prologue.
 */
/**
 * Format JSON-like data into valid JavaScript object literal syntax.
 * Forces unquoted keys to ensure the 'property' token is used for highlighting.
 */
function formatJsonWithUnquotedKeys(obj: any, indent = 0): string {
  const indentStr = '  '.repeat(indent);
  const nextIndentStr = '  '.repeat(indent + 1);

  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);

  if (typeof obj === 'string') {
    return formatStringValue(obj, indent);
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item =>
      `${nextIndentStr}${formatJsonWithUnquotedKeys(item, indent + 1)}`
    );
    return `[\n${items.join(',\n')}\n${indentStr}]`;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';

    const items = keys.map(key => {
      const value = formatJsonWithUnquotedKeys(obj[key], indent + 1);
      // Ensure key is a valid JS identifier; if not, you might need
      // quotes, but for MongoDB/standard docs, unquoted is usually fine.
      return `${nextIndentStr}${key}: ${value}`;
    });

    return `{\n${items.join(',\n')}\n${indentStr}}`;
  }

  return String(obj);
}

const MonacoViewer: React.FC<MonacoViewerProps> = ({ document, truncateValues = true }) => {
  const monaco = useMonaco();
  const [showAllFields, setShowAllFields] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // We keep a reference to the editor so we can re-apply view settings when content changes.
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Define custom theme and folding provider when Monaco is ready
  // Uses JavaScript language for syntax highlighting (like VS Code playgrounds)
  useEffect(() => {
    if (monaco) {
      // Detect VS Code theme type by checking body classes
      // VS Code adds these classes based on the active theme kind
      let themeBase: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light' = 'vs-dark';
      const bodyClassList = globalThis.document.body.classList;

      if (bodyClassList.contains('vscode-high-contrast-light')) {
        themeBase = 'hc-light';
      } else if (bodyClassList.contains('vscode-high-contrast')) {
        themeBase = 'hc-black';
      } else if (bodyClassList.contains('vscode-light')) {
        themeBase = 'vs';
      } else if (bodyClassList.contains('vscode-dark')) {
        themeBase = 'vs-dark';
      }

      // Define a transparent background theme that inherits VS Code's JavaScript highlighting
    monaco.editor.defineTheme('mongoTheme', {
      base: themeBase,
      inherit: true,
      rules: [
        // Object keys should be blue (like VS Code's default for JS object properties)
        { token: 'key', foreground: '9CDCFE' },
        { token: 'key.identifier', foreground: '9CDCFE' },
        { token: 'property', foreground: '9CDCFE' },
        { token: 'identifier.key', foreground: '9CDCFE' },
        { token: 'variable.other.property', foreground: '9CDCFE' },
        { token: 'variable.other.object.property', foreground: '9CDCFE' },
        { token: 'meta.object-literal.key', foreground: '9CDCFE' },
        { token: 'support.type.property-name', foreground: '9CDCFE' },
        { token: 'entity.name.tag', foreground: '9CDCFE' },
        // Identifiers in general (this might be what's catching the keys)
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'variable.other', foreground: '9CDCFE' },
        { token: 'variable.other.readwrite', foreground: '9CDCFE' },
        { token: 'variable.other.constant', foreground: '9CDCFE' },
        // This ensures strings inside the object stay the standard string color
        { token: 'string', foreground: 'CE9178' },
        { token: 'string.quoted', foreground: 'CE9178' },
        { token: 'string.quoted.double', foreground: 'CE9178' },
        { token: 'string.quoted.single', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#00000000',
        'editorGutter.background': '#00000000',
      },
    });

      // Register custom folding provider for JavaScript that folds objects and arrays
      const foldingProvider = monaco.languages.registerFoldingRangeProvider('javascript', {
        provideFoldingRanges: (model) => {
          const ranges: Monaco.languages.FoldingRange[] = [];
          const lines = model.getLinesContent();
          const stack: { line: number; char: string }[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Check for opening braces/brackets at end of line
            if (trimmed.endsWith('{') || trimmed.endsWith('[')) {
              stack.push({ line: i + 1, char: trimmed.endsWith('{') ? '{' : '[' });
            }

            // Check for closing braces/brackets (line is just } or }, or ] or ],)
            const isClosingBrace = trimmed === '}' || trimmed === '},';
            const isClosingBracket = trimmed === ']' || trimmed === '],';

            if (isClosingBrace || isClosingBracket) {
              const expectedOpen = isClosingBrace ? '{' : '[';
              for (let j = stack.length - 1; j >= 0; j--) {
                if (stack[j].char === expectedOpen) {
                  const startLine = stack[j].line;
                  if (i + 1 > startLine) {
                    ranges.push({
                      start: startLine,
                      end: i + 1,
                      kind: monaco.languages.FoldingRangeKind.Region,
                    });
                  }
                  stack.splice(j, 1);
                  break;
                }
              }
            }
          }

          return ranges;
        },
      });

      return () => {
        foldingProvider.dispose();
      };
    }
  }, [monaco]);

  // Count top-level fields
  const totalFieldCount = useMemo(() => Object.keys(document).length, [document]);
  const hasMoreFields = totalFieldCount > MAX_INITIAL_FIELDS;
  const hiddenFieldCount = totalFieldCount - MAX_INITIAL_FIELDS;

  // Determine which document to display (sliced or full)
  const displayDocument = useMemo(() => {
    if (!hasMoreFields || showAllFields) {
      return document;
    }
    return sliceDocumentFields(document, MAX_INITIAL_FIELDS);
  }, [document, hasMoreFields, showAllFields]);

  const formattedDocument = useMemo(() => {
    const docToFormat = truncateValues
      ? truncateLongValues(displayDocument)
      : displayDocument;
    return formatJsonWithUnquotedKeys(docToFormat);
  }, [displayDocument, truncateValues]);


  // Calculate editor height based on content
  const editorHeight = useMemo(() => {
    // The first line of `jsonValue` is a hidden prologue; size based on what is actually shown.
    const lineCount = formattedDocument.split('\n').length;
    const contentHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING * 2;
    return Math.min(contentHeight, MAX_EDITOR_HEIGHT);
  }, [formattedDocument]);

const jsonValue = useMemo(() => {
  // We trim the formatted document to avoid double-wrapping braces
  // and put the first brace on the hidden prologue line.
  return formattedDocument;
}, [formattedDocument]);

const hidePrologueLine = useCallback(() => {
  if (!monaco || !editorRef.current) return;

  const editorInstance: any = editorRef.current;

  // We hide only the very first line "const doc = {"
  // This leaves the rest of the object visible and correctly tokenized.
  if (typeof editorInstance.setHiddenAreas === 'function') {
    editorInstance.setHiddenAreas([
      new monaco.Range(1, 1, 1, 1),
    ]);
  }
}, [monaco]);

  // Disable find widget when editor mounts
  const handleEditorMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;

    // Disable the find widget command
    editorInstance.addCommand(
      monaco?.KeyMod.CtrlCmd! | monaco?.KeyCode.KeyF!,
      () => {
        // Do nothing - prevents find widget from opening
      }
    );

    // Listen for context menu events (right-click)
    editorInstance.onContextMenu((e) => {
      e.event.preventDefault();
      e.event.stopPropagation();

      // Get the mouse position relative to the viewport
      const x = e.event.posx;
      const y = e.event.posy;

      setContextMenu({ x, y });
    });

    // Ensure the prologue is hidden on initial mount.
    // Defer to next tick so the model/layout is ready.
    setTimeout(() => hidePrologueLine(), 0);
  }, [monaco, hidePrologueLine]);

  // Re-apply hidden prologue when the document changes (e.g., Show more/less).
  useEffect(() => {
    setTimeout(() => hidePrologueLine(), 0);
  }, [jsonValue, hidePrologueLine]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      window.document.addEventListener('click', handleClickOutside);
      return () => {
        window.document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu]);

  return (
    <div className={cardStyles}>
      <div className={monacoWrapperStyles}>
        <Editor
          height={editorHeight}
          defaultLanguage="typescript"
          value={jsonValue}
          theme="mongoTheme"
          options={viewerOptions}
          loading={null}
          onMount={handleEditorMount}
        />
      </div>

      {hasMoreFields && !showAllFields && (
        <button
          className={showMoreButtonStyles}
          onClick={() => setShowAllFields(true)}
          data-expanded="false"
        >
          Show {hiddenFieldCount} more field{hiddenFieldCount !== 1 ? 's' : ''}
        </button>
      )}

      {hasMoreFields && showAllFields && (
        <button
          className={showMoreButtonStyles}
          onClick={() => setShowAllFields(false)}
          data-expanded="true"
        >
          Show less
        </button>
      )}

      {/* Custom context menu */}
      {contextMenu && (
        <div
          className={contextMenuStyles}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={contextMenuItemStyles}
            onClick={() => {
              // Add your custom action here
              console.log('Copy action');
              setContextMenu(null);
            }}
          >
            Copy
          </button>
          <button
            className={contextMenuItemStyles}
            onClick={() => {
              // Add your custom action here
              console.log('Select All action');
              setContextMenu(null);
            }}
          >
            Select All
          </button>
          <button
            className={contextMenuItemStyles}
            onClick={() => {
              // Add your custom action here
              console.log('Custom Action');
              setContextMenu(null);
            }}
          >
            Custom Action
          </button>
        </div>
      )}
    </div>
  );
};

export default MonacoViewer;

