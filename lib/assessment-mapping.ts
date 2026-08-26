export type MappingStatus = 'mapped' | 'not_answered' | 'uncertain';

export type AnswerRegion = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  status: MappingStatus;
  answerText: string;
};

export type MappedQuestion = {
  id: number;
  label: string;
  text: string;
  max: number;
  score: number;
  feedback: string;
  mapping: AnswerRegion;
};

export type AssessmentMappingResponse = {
  questions: MappedQuestion[];
  answerPageCount: number;
  summary: string;
  model: string;
};

type ApiMappedQuestion = {
  question_number: string;
  question_text: string;
  max_marks: number;
  awarded_marks: number;
  feedback: string;
  answer_text: string;
  answer_page: number;
  region: { x: number; y: number; width: number; height: number };
  confidence: number;
  status: MappingStatus;
};

export type ApiAssessmentMapping = {
  questions: ApiMappedQuestion[];
  answer_page_count: number;
  summary: string;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export function normalizeAssessmentMapping(result: ApiAssessmentMapping, model: string): AssessmentMappingResponse {
  const answerPageCount = Math.max(1, Math.round(result.answer_page_count || 1));
  const questions = result.questions.slice(0, 60).map((question, index): MappedQuestion => {
    const max = Math.max(0.5, Math.round(clamp(question.max_marks, 0.5, 100) * 2) / 2);
    const score = Math.round(clamp(question.awarded_marks, 0, max) * 2) / 2;
    const status: MappingStatus = ['mapped', 'not_answered', 'uncertain'].includes(question.status)
      ? question.status
      : 'uncertain';

    return {
      id: index + 1,
      label: question.question_number.trim() || String(index + 1),
      text: question.question_text.trim() || `Question ${index + 1}`,
      max,
      score,
      feedback: question.feedback.trim() || 'Review the mapped response before finalising marks.',
      mapping: {
        page: Math.round(clamp(question.answer_page, 1, answerPageCount)),
        x: clamp(question.region.x, 0, 100),
        y: clamp(question.region.y, 0, 100),
        width: clamp(question.region.width, 0, 100),
        height: clamp(question.region.height, 0, 100),
        confidence: clamp(question.confidence, 0, 1),
        status,
        answerText: question.answer_text.trim(),
      },
    };
  });

  return {
    questions,
    answerPageCount,
    summary: result.summary.trim(),
    model,
  };
}

export const assessmentMappingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questions', 'answer_page_count', 'summary'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 60,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'question_number', 'question_text', 'max_marks', 'awarded_marks', 'feedback',
          'answer_text', 'answer_page', 'region', 'confidence', 'status',
        ],
        properties: {
          question_number: { type: 'string' },
          question_text: { type: 'string' },
          max_marks: { type: 'number', minimum: 0.5, maximum: 100 },
          awarded_marks: { type: 'number', minimum: 0, maximum: 100 },
          feedback: { type: 'string' },
          answer_text: { type: 'string' },
          answer_page: { type: 'integer', minimum: 1 },
          region: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'width', 'height'],
            properties: {
              x: { type: 'number', minimum: 0, maximum: 100 },
              y: { type: 'number', minimum: 0, maximum: 100 },
              width: { type: 'number', minimum: 0, maximum: 100 },
              height: { type: 'number', minimum: 0, maximum: 100 },
            },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          status: { type: 'string', enum: ['mapped', 'not_answered', 'uncertain'] },
        },
      },
    },
    answer_page_count: { type: 'integer', minimum: 1 },
    summary: { type: 'string' },
  },
} as const;
