export type ExtractedQuestion = {
  id: number;
  text: string;
  max: number;
  score: number;
  feedback: string;
};

export type ExtractionResult = {
  questions: ExtractedQuestion[];
  pageCount: number;
  characterCount: number;
  mode: 'pdf-text' | 'fallback';
  message: string;
};

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
};

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function marksFromText(value: string) {
  const matches = [
    value.match(/\[(\d+(?:\.5)?)\]\s*$/),
    value.match(/\((\d+(?:\.5)?)\s*(?:marks?|m)\)\s*$/i),
    value.match(/\b(\d+(?:\.5)?)\s*(?:marks?|m)\s*$/i),
  ];
  const match = matches.find(Boolean);
  const parsed = match ? Number(match[1]) : 2;
  return Math.max(1, Math.min(parsed, 20));
}

function removeMarks(value: string) {
  return value
    .replace(/\s*\[\d+(?:\.5)?\]\s*$/, '')
    .replace(/\s*\(\d+(?:\.5)?\s*(?:marks?|m)\)\s*$/i, '')
    .replace(/\s+\d+(?:\.5)?\s*(?:marks?|m)\s*$/i, '')
    .trim();
}

export function parseQuestionsFromText(text: string) {
  const lines = text.split('\n').map((line) => cleanText(line)).filter(Boolean);
  const candidates: Array<{ sourceNumber: number; body: string }> = [];
  let current: { sourceNumber: number; body: string } | null = null;

  for (const line of lines) {
    const numbered = line.match(/^\s*(?:q(?:uestion)?\s*)?(\d{1,2})\s*[.)\-:]\s+(.+)$/i);
    if (numbered) {
      if (current) candidates.push(current);
      current = { sourceNumber: Number(numbered[1]), body: numbered[2] };
      continue;
    }

    if (current) current.body += ` ${line}`;
  }
  if (current) candidates.push(current);

  if (candidates.length < 2) {
    const inlinePattern = /(?:^|\s)(?:q(?:uestion)?\s*)?(\d{1,2})\s*[.)\-:]\s+(.+?)(?=(?:\s+(?:q(?:uestion)?\s*)?\d{1,2}\s*[.)\-:]\s+)|$)/gis;
    candidates.length = 0;
    for (const match of text.matchAll(inlinePattern)) candidates.push({ sourceNumber: Number(match[1]), body: cleanText(match[2]) });
  }

  return candidates
    .filter((candidate) => candidate.body.length >= 12)
    .filter((candidate, index, all) => index === 0 || candidate.sourceNumber !== all[index - 1].sourceNumber)
    .slice(0, 40)
    .map((candidate, index): ExtractedQuestion => ({
      id: index + 1,
      text: removeMarks(candidate.body),
      max: marksFromText(candidate.body),
      score: 0,
      feedback: 'Review the mapped response and add teacher feedback.',
    }));
}

async function loadPdfDocument(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

export async function getPdfPageCount(file: File) {
  const document = await loadPdfDocument(file);
  const pageCount = document.numPages;
  await document.destroy();
  return pageCount;
}

export async function extractQuestionsFromPdf(file: File): Promise<ExtractionResult> {
  const document = await loadPdfDocument(file);
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = (content.items as PdfTextItem[])
      .map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`)
      .join('');
    pages.push(cleanText(pageText));
    page.cleanup();
  }

  const pageCount = document.numPages;
  await document.destroy();
  const fullText = pages.join('\n');
  const questions = parseQuestionsFromText(fullText);

  if (questions.length < 2) {
    return {
      questions: [],
      pageCount,
      characterCount: fullText.length,
      mode: 'fallback',
      message: fullText.length === 0
        ? 'This appears to be a scanned PDF. Verify the detected question placeholders before grading.'
        : 'Text was detected, but the question numbering could not be read reliably. Verify the placeholders before grading.',
    };
  }

  return {
    questions,
    pageCount,
    characterCount: fullText.length,
    mode: 'pdf-text',
    message: `${questions.length} questions extracted from ${pageCount} PDF ${pageCount === 1 ? 'page' : 'pages'}.`,
  };
}
