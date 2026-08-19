import {
  $createCodeHighlightNode,
  $isCodeHighlightNode,
  PrismTokenizer,
  registerCodeHighlighting,
} from '@lexical/code'
import { $isTextNode, type LexicalNode } from 'lexical'
import type { CodeNode } from '@lexical/code'

// `Tokenizer` is only re-exported through @lexical/code-prism, which is not a
// direct dependency here — take it from the function that consumes it instead.
type Tokenizer = NonNullable<Parameters<typeof registerCodeHighlighting>[1]>

type StyleRange = { start: number; end: number; style: string }
type StyledSegment = { text: string; style: string }

// Prism re-tokenizes the whole code block on every change and replaces any node
// whose text/token type no longer matches, which drops inline styles applied by
// the toolbar (highlight, font color). Re-applying the styles while tokenizing
// makes them part of the expected node list, so the diff keeps them in place.
function $collectStyleRanges(codeNode: CodeNode): StyleRange[] {
  const ranges: StyleRange[] = []
  let offset = 0

  codeNode.getChildren().forEach((child) => {
    const size = child.getTextContentSize()
    if ($isTextNode(child)) {
      const style = child.getStyle()
      if (style) {
        ranges.push({ start: offset, end: offset + size, style })
      }
    }
    offset += size
  })

  return ranges
}

function splitByStyle(text: string, start: number, ranges: StyleRange[]): StyledSegment[] {
  const end = start + text.length
  const segments: StyledSegment[] = []
  let cursor = start

  for (const range of ranges) {
    if (range.end <= cursor) continue
    if (range.start >= end) break

    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor - start, range.start - start), style: '' })
      cursor = range.start
    }

    const stop = Math.min(range.end, end)
    segments.push({ text: text.slice(cursor - start, stop - start), style: range.style })
    cursor = stop
  }

  if (cursor < end) {
    segments.push({ text: text.slice(cursor - start), style: '' })
  }

  return segments
}

function $applyStyleRanges(nodes: LexicalNode[], ranges: StyleRange[]): LexicalNode[] {
  if (ranges.length === 0) return nodes

  const result: LexicalNode[] = []
  let offset = 0

  nodes.forEach((node) => {
    const size = node.getTextContentSize()
    if (!$isCodeHighlightNode(node) || size === 0) {
      result.push(node)
      offset += size
      return
    }

    const segments = splitByStyle(node.getTextContent(), offset, ranges)
    offset += size

    if (segments.length === 1) {
      result.push(segments[0].style ? node.setStyle(segments[0].style) : node)
      return
    }

    const highlightType = node.getHighlightType()
    segments.forEach((segment) => {
      const piece = $createCodeHighlightNode(segment.text, highlightType)
      result.push(segment.style ? piece.setStyle(segment.style) : piece)
    })
  })

  return result
}

export const styleAwareCodeTokenizer: Tokenizer = {
  ...PrismTokenizer,
  $tokenize(codeNode, language) {
    const nodes = PrismTokenizer.$tokenize(codeNode, language)
    return $applyStyleRanges(nodes, $collectStyleRanges(codeNode))
  },
}
