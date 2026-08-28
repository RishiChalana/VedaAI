export type MappingStatus = 'mapped' | 'not_answered' | 'uncertain';

// A single highlight rectangle on one answer-sheet page.
// Units are percent of the page (0–100); left/top is the top-left corner.
// Pixel positions are computed at RENDER time against the live page element,
// never baked in here.
export type AnswerRegion = {
  page: number; // 1-based
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MappedQuestion = {
  id: number;
  label: string;
  text: string;
  max: number;
  score: number;
  feedback: string;
  status: MappingStatus;
  confidence: number;
  answerText: string;
  regions: AnswerRegion[]; // empty when not_answered
};

export type UnmatchedAnswer = {
  id: number;
  transcript: string;
  note: string;
  region: AnswerRegion;
};

export type AssessmentMappingResponse = {
  transcript?: string;
  questions: MappedQuestion[];
  unmatchedAnswers: UnmatchedAnswer[];
  answerPageCount: number;
  summary: string;
  model: string;
};

// Gemini native bounding box: [ymin, xmin, ymax, xmax], each normalized 0–1000.
type Box2d = [number, number, number, number];

type ApiRegion = {
  page: number;
  box_2d: Box2d;
};

type ApiMappedQuestion = {
  question_number: string;
  question_text: string;
  max_marks: number;
  awarded_marks: number;
  feedback: string;
  answer_text: string;
  regions: ApiRegion[];
  confidence: number;
  status: MappingStatus;
};

type ApiUnmatchedAnswer = {
  transcript: string;
  page: number;
  box_2d: Box2d;
  note: string;
};

export type ApiAssessmentMapping = {
  transcript?: string;
  questions: ApiMappedQuestion[];
  unmatched_answers: ApiUnmatchedAnswer[];
  answer_page_count: number;
  summary: string;
};

// Maximum highlight rectangles kept per answer / per unmatched entry. Mirrors the
// `maxItems` cap in the JSON schema so a messy page can't emit unbounded regions.
const MAX_REGIONS = 6;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

// Convert a Gemini box_2d ([ymin, xmin, ymax, xmax], 0–1000) plus a page number
// into a percent-based AnswerRegion. Returns null for malformed boxes (wrong
// array length / non-finite values), degenerate (zero-area) boxes, or a page
// outside the answer sheet.
function box2dToRegion(box: unknown, pageRaw: unknown, answerPageCount: number): AnswerRegion | null {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const nums = box.map(Number);
  if (!nums.every(Number.isFinite)) return null;
  const [ymin, xmin, ymax, xmax] = nums;

  const page = Math.round(Number(pageRaw));
  if (!Number.isFinite(page) || page < 1 || page > answerPageCount) return null;

  const left = clamp(xmin / 10, 0, 100);
  const top = clamp(ymin / 10, 0, 100);
  const width = clamp((xmax - xmin) / 10, 0, 100);
  const height = clamp((ymax - ymin) / 10, 0, 100);
  if (width <= 0 || height <= 0) return null;

  return { page, left, top, width, height };
}

export function normalizeAssessmentMapping(result: ApiAssessmentMapping, model: string): AssessmentMappingResponse {
  const answerPageCount = Math.max(1, Math.round(result?.answer_page_count || 1));
  const questionsList = Array.isArray(result?.questions) ? result.questions : [];

  const questions = questionsList.slice(0, 60).map((question, index): MappedQuestion => {
    const safeMaxMarks = Number(question?.max_marks) || 1;
    const safeAwardedMarks = Number(question?.awarded_marks) || 0;

    const max = Math.max(0.5, Math.round(clamp(safeMaxMarks, 0.5, 100) * 2) / 2);
    const score = Math.round(clamp(safeAwardedMarks, 0, max) * 2) / 2;
    const status: MappingStatus = ['mapped', 'not_answered', 'uncertain'].includes(question?.status as string)
      ? question.status
      : 'uncertain';

    const regions = (Array.isArray(question?.regions) ? question.regions : [])
      .slice(0, MAX_REGIONS)
      .map((region) => box2dToRegion(region?.box_2d, region?.page, answerPageCount))
      .filter((region): region is AnswerRegion => region !== null);

    return {
      id: index + 1,
      label: String(question?.question_number || index + 1).trim(),
      text: String(question?.question_text || `Question ${index + 1}`).trim(),
      max,
      score,
      feedback: String(question?.feedback || 'Review the mapped response before finalising marks.').trim(),
      status,
      confidence: clamp(Number(question?.confidence) || 0, 0, 1),
      answerText: String(question?.answer_text || '').trim(),
      regions,
    };
  });

  const unmatchedAnswers = (Array.isArray(result?.unmatched_answers) ? result.unmatched_answers : [])
    .slice(0, MAX_REGIONS)
    .map((entry, index): UnmatchedAnswer | null => {
      const region = box2dToRegion(entry?.box_2d, entry?.page, answerPageCount);
      if (!region) return null;
      return {
        id: index + 1,
        transcript: String(entry?.transcript || '').trim(),
        note: String(entry?.note || '').trim(),
        region,
      };
    })
    .filter((entry): entry is UnmatchedAnswer => entry !== null);

  return {
    transcript: typeof result?.transcript === 'string' ? result.transcript : undefined,
    questions,
    unmatchedAnswers,
    answerPageCount,
    summary: String(result?.summary || '').trim(),
    model,
  };
}

export const questionExtractionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question_number', 'question_text', 'max_marks'],
        properties: {
          question_number: { type: 'string' },
          question_text: { type: 'string' },
          max_marks: { type: 'number' },
        }
      }
    }
  }
};

// Gemini native bounding box: [ymin, xmin, ymax, xmax], each an integer 0–1000
// normalized to the page. Reused by question regions and unmatched answers.
const box2dSchema = {
  type: 'array',
  description: 'Bounding box in native format [ymin, xmin, ymax, xmax], each value an integer normalized 0–1000 relative to the page (0,0 = top-left).',
  items: { type: 'integer', minimum: 0, maximum: 1000 },
  minItems: 4,
  maxItems: 4,
} as const;

export const assessmentMappingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['transcript', 'questions', 'unmatched_answers', 'answer_page_count', 'summary'],
  properties: {
    transcript: { type: 'string', description: 'Complete transcription of the answer sheet text and scratchpad reasoning.' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'question_number', 'question_text', 'max_marks', 'awarded_marks', 'feedback',
          'answer_text', 'regions', 'confidence', 'status',
        ],
        properties: {
          question_number: { type: 'string' },
          question_text: { type: 'string' },
          max_marks: { type: 'number' },
          awarded_marks: { type: 'number' },
          feedback: { type: 'string' },
          answer_text: { type: 'string' },
          regions: {
            type: 'array',
            description: 'One or more rectangles enclosing the complete answer, across pages if it spans multiple. Empty array when status is not_answered.',
            maxItems: 6,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['page', 'box_2d'],
              properties: {
                page: { type: 'integer', description: '1-based answer-sheet page this rectangle is on.' },
                box_2d: box2dSchema,
              },
            },
          },
          confidence: { type: 'number' },
          status: { type: 'string', enum: ['mapped', 'not_answered', 'uncertain'] },
        },
      },
    },
    unmatched_answers: {
      type: 'array',
      description: 'Handwritten content on the answer sheet that does not correspond to any checklist question. Empty array if none.',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['transcript', 'page', 'box_2d', 'note'],
        properties: {
          transcript: { type: 'string' },
          page: { type: 'integer', description: '1-based answer-sheet page.' },
          box_2d: box2dSchema,
          note: { type: 'string', description: 'Short teacher-facing note on why this content matches no question.' },
        },
      },
    },
    answer_page_count: { type: 'integer' },
    summary: { type: 'string' },
  },
} as const;
