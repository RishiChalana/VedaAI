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

    return {
      id: index + 1,
      label: String(question?.question_number || index + 1).trim(),
      text: String(question?.question_text || `Question ${index + 1}`).trim(),
      max,
      score,
      feedback: String(question?.feedback || 'Review the mapped response before finalising marks.').trim(),
      mapping: {
        page: Math.round(clamp(Number(question?.answer_page) || 1, 1, answerPageCount)),
        x: clamp(Number(question?.region?.x) || 0, 0, 100),
        y: clamp(Number(question?.region?.y) || 0, 0, 100),
        width: clamp(Number(question?.region?.width) || 0, 0, 100),
        height: clamp(Number(question?.region?.height) || 0, 0, 100),
        confidence: clamp(Number(question?.confidence) || 0, 0, 1),
        status,
        answerText: String(question?.answer_text || '').trim(),
      },
    };
  });

  return {
    questions,
    answerPageCount,
    summary: String(result?.summary || '').trim(),
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
          max_marks: { type: 'number' },
          awarded_marks: { type: 'number' },
          feedback: { type: 'string' },
          answer_text: { type: 'string' },
          answer_page: { type: 'integer' },
          region: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'width', 'height'],
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
            },
          },
          confidence: { type: 'number' },
          status: { type: 'string', enum: ['mapped', 'not_answered', 'uncertain'] },
        },
      },
    },
    answer_page_count: { type: 'integer' },
    summary: { type: 'string' },
  },
} as const;
