import React, { lazy, Suspense } from 'react';
import type { RichTextEditorProps } from './RichTextEditor';

const RichTextEditor = lazy(() => import('./RichTextEditor'));

/** RichTextEditor in its own chunk: only editors who open a modal download Tiptap. */
const LazyRichTextEditor: React.FC<RichTextEditorProps> = (props) => (
  <Suspense fallback={<div className="rte rte-loading">Loading editor…</div>}>
    <RichTextEditor {...props} />
  </Suspense>
);

export default LazyRichTextEditor;
