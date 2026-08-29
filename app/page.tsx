'use client';

/* eslint-disable @next/next/no-img-element -- previews use temporary object URLs that next/image cannot optimize */

import {
  ChangeEvent,
  DragEvent,
  type CSSProperties,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  extractQuestionsFromPdf,
  type ExtractionResult,
} from '../lib/document-extraction';
import {
  type AnswerRegion,
  type AssessmentMappingResponse,
  type MappingStatus,
  type UnmatchedAnswer,
} from '../lib/assessment-mapping';

type UploadKind = 'question' | 'answer';
type Screen = 'upload' | 'extracting' | 'results';
type MobileTab = 'questions' | 'answer';
// Extracting-screen phases: real upload (determinate) then server analysis (indeterminate).
type MappingPhase = 'uploading' | 'processing';
type HeaderPanel = 'help' | 'notifications' | 'profile' | null;
type ExtractionMeta = {
  pageCount: number;
  characterCount: number;
  mode: ExtractionResult['mode'] | 'ai' | 'demo';
  message: string;
};

type UploadedFile = {
  name: string;
  size: string;
  pages: number;
  mime: string;
  source: 'uploaded' | 'demo';
  url?: string;
  rawFile?: File;
};

type Question = {
  id: number;
  label?: string;
  text: string;
  max: number;
  score: number;
  feedback: string;
  status?: MappingStatus;
  confidence?: number;
  answerText?: string;
  regions?: AnswerRegion[];
};

// A single rectangle to draw over the rendered answer-sheet page.
type Highlight = AnswerRegion & { label: string; variant: 'mapped' | 'uncertain' | 'unmatched' };

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const navItems = [
  ['⌂', 'Home'],
  ['▦', 'My Classroom'],
  ['✓', 'Assignments'],
  ['▤', 'Exams'],
  ['◇', 'My Library'],
];

const initialQuestions: Question[] = [
  { id: 1, text: 'What does natural selection mean? How has it contributed to evolution?', max: 3, score: 3, feedback: 'Clear definition with a relevant link to survival and reproduction.' },
  { id: 2, text: 'What is the following organism commonly mistaken for? Identify it.', max: 2, score: 1.5, feedback: 'The organism is identified correctly. Add one distinguishing feature to earn full marks.' },
  { id: 3, text: 'Explain the role of chloroplasts in photosynthesis, naming the main pigments involved.', max: 4, score: 4, feedback: 'Accurate explanation of chlorophyll and light-energy conversion.' },
  { id: 4, text: 'Describe the flow of blood through the human heart starting from the right atrium.', max: 5, score: 3.5, feedback: 'The sequence is mostly correct, but the pulmonary vein is missing.' },
  { id: 5, text: 'Give a labelled diagram of an animal cell showing at least four organelles.', max: 4, score: 4, feedback: 'Well-labelled diagram with the required organelles.' },
  { id: 6, text: 'How is asexual reproduction different from sexual reproduction?', max: 3, score: 2, feedback: 'Good comparison. Include genetic variation for a complete answer.' },
  { id: 7, text: 'Describe reflex action and illustrate the reflex arc with an example.', max: 4, score: 3, feedback: 'Correct pathway and example; the role of the relay neuron needs clarification.' },
  { id: 8, text: 'Explain how the structure of xylem supports its function in plants.', max: 3, score: 3, feedback: 'Concise and scientifically accurate response.' },
  { id: 9, text: 'A plant bends toward sunlight. Name and explain this response.', max: 2, score: 1, feedback: 'Phototropism is named correctly, but auxin redistribution is not explained.' },
  { id: 10, text: 'Why are food chains generally limited to four or five trophic levels?', max: 3, score: 2.5, feedback: 'Correct energy-loss principle; quantify the transfer for full credit.' },
  { id: 11, text: 'State two functions of the ozone layer and one cause of its depletion.', max: 3, score: 3, feedback: 'All requested points are present and correct.' },
  { id: 12, text: 'Differentiate biodegradable and non-biodegradable waste with examples.', max: 4, score: 4, feedback: 'Complete comparison supported by suitable examples.' },
];

const sampleQuestions: Question[] = [
  { id: 1, label: '1', text: 'Define photosynthesis and write its balanced chemical equation.', max: 3, score: 3, feedback: 'Complete definition and a correct balanced equation.', status: 'mapped', confidence: 0.99, answerText: 'Photosynthesis is how green plants prepare food using sunlight, carbon dioxide and water, and release oxygen. 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.', regions: [{ page: 1, left: 8, top: 10, width: 86, height: 12 }] },
  { id: 2, label: '2', text: 'Why do plants appear green?', max: 2, score: 1.5, feedback: 'Correct reflection explanation; naming the other absorbed wavelengths would make it complete.', status: 'mapped', confidence: 0.98, answerText: 'Plants look green because chlorophyll absorbs light and reflects the green colour back to our eyes.', regions: [{ page: 1, left: 8, top: 24, width: 86, height: 10 }] },
  { id: 3, label: '3', text: 'Draw and label a chloroplast. Name the two main stages of photosynthesis.', max: 4, score: 4, feedback: 'Clear labelled diagram with both stages correctly named.', status: 'mapped', confidence: 0.99, answerText: 'A chloroplast contains stacks of thylakoids (grana) inside the fluid stroma. The two stages are the light reaction and Calvin cycle.', regions: [{ page: 1, left: 8, top: 35, width: 86, height: 30 }] },
  { id: 4, label: '4', text: 'Explain how stomata help a plant during photosynthesis.', max: 3, score: 3, feedback: 'Accurately explains gas exchange and the role of guard cells.', status: 'mapped', confidence: 0.98, answerText: 'Stomata let carbon dioxide enter and oxygen leave. Guard cells open and close each pore.', regions: [{ page: 1, left: 8, top: 68, width: 86, height: 14 }] },
];

function createVerificationQuestions(pageCount: number): Question[] {
  const count = Math.min(Math.max(pageCount, 4), 12);
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    text: `Question ${index + 1} · verify text against the uploaded paper`,
    max: 1,
    score: 0,
    feedback: 'Automatic text extraction was unavailable. Verify this question and its mapped answer before grading.',
  }));
}

const answerText: Record<number, string[]> = {
  1: ['Natural selection is the process in which organisms with useful variations survive and reproduce.', 'Over generations, favourable traits become common and this causes evolution.'],
  2: ['This organism is commonly mistaken for a plant.', 'It is actually a sea anemone, an animal attached to rocks.'],
  3: ['Chloroplasts contain chlorophyll that absorbs sunlight.', 'Light energy is converted into chemical energy during photosynthesis.'],
  4: ['Blood enters the right atrium, travels to the right ventricle and then to the lungs.', 'Oxygenated blood returns to the left side and is pumped to the body.'],
  5: ['Animal cell: cell membrane, nucleus, cytoplasm and mitochondria are labelled.'],
  6: ['Asexual reproduction uses one parent while sexual reproduction involves two parents.'],
  7: ['A reflex is a rapid automatic response through a reflex arc in the spinal cord.'],
  8: ['Xylem vessels are hollow and lignified, forming continuous tubes for water transport.'],
  9: ['The response is phototropism. The shoot grows towards the light.'],
  10: ['Energy is lost at each trophic level, leaving too little energy at higher levels.'],
  11: ['Ozone absorbs harmful UV radiation. CFCs cause ozone depletion.'],
  12: ['Biodegradable waste decomposes naturally; non-biodegradable waste persists.'],
};

function VedaMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`veda-mark ${compact ? 'veda-mark--compact' : ''}`} aria-label="VedaAI">
      <span className="veda-symbol">V</span>
      {!compact && <span className="veda-wordmark">VedaAI</span>}
    </div>
  );
}

function Header({ screen, onBack, onNavigate }: { screen: Screen; onBack: () => void; onNavigate: (label: string) => void }) {
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const togglePanel = (next: HeaderPanel) => setPanel(panel === next ? null : next);
  const isBackVisible = screen === 'results' || screen === 'extracting';
  const title = screen === 'results' ? 'Assessment review' : 'Exams';

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          {isBackVisible && <button className="icon-button back-button" aria-label="Go back" onClick={onBack}>←</button>}
          <span className="page-crumb">{title}</span>
        </div>
        <div className="mobile-brand"><VedaMark /></div>
        <div className="topbar-actions">
          <button className="icon-button desktop-only" aria-label="Help" onClick={() => togglePanel('help')}>?</button>
          <button className="icon-button notification" aria-label="Notifications" onClick={() => togglePanel('notifications')}>♢<span /></button>
          <span className="spark-mini" aria-hidden="true">✦</span>
          <button className="profile-button" aria-label="Open profile" onClick={() => togglePanel('profile')}>
            <span className="avatar">MR</span>
            <span className="profile-copy desktop-only"><strong>Madhur Rastogi</strong><small>Teacher</small></span>
            <span className="desktop-only">⌄</span>
          </button>
          <button className="icon-button mobile-only" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}>☰</button>
        </div>
      </header>

      {panel && (
        <div className="topbar-popover" role="dialog" aria-label={`${panel} panel`}>
          <button className="popover-close" aria-label="Close" onClick={() => setPanel(null)}>×</button>
          {panel === 'help' && <><span className="popover-icon">✦</span><strong>Assessment mapping help</strong><p>Upload one question paper and one answer sheet. VedaAI maps each answer for teacher review.</p></>}
          {panel === 'notifications' && <><span className="popover-icon">✓</span><strong>You&apos;re all caught up</strong><p>Your assessment workspace has no new notifications.</p></>}
          {panel === 'profile' && <><span className="popover-icon popover-avatar">MR</span><strong>Madhur Rastogi</strong><p>Teacher · Delhi Public School</p><button className="popover-action" onClick={() => { setPanel(null); onNavigate('Settings'); }}>View profile</button></>}
        </div>
      )}

      {mobileMenu && (
        <div className="mobile-menu" role="dialog" aria-label="Mobile navigation">
          {navItems.map(([icon, label]) => <button key={label} className={label === 'Exams' ? 'active' : ''} onClick={() => { setMobileMenu(false); onNavigate(label); }}><span>{icon}</span>{label}</button>)}
        </div>
      )}
    </>
  );
}

function Sidebar({ compact, onNotice, onNavigate }: { compact: boolean; onNotice: (message: string) => void; onNavigate: (label: string) => void }) {
  return (
    <aside className={`sidebar ${compact ? 'sidebar--compact' : ''}`}>
      <VedaMark compact={compact} />
      <button className="toolkit-button" aria-label="AI Teacher's Toolkit" onClick={() => onNotice('Assessment Mapper is part of the AI Teacher’s Toolkit.')}><span>✦</span><b>AI Teacher&apos;s Toolkit</b></button>
      <nav aria-label="Primary navigation">
        {navItems.map(([icon, label]) => {
          const isActive = label === 'Exams';
          return <button key={label} className={isActive ? 'active' : ''} title={label} onClick={() => onNavigate(label)}><span className="nav-icon">{icon}</span><b>{label}</b></button>;
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="settings" title="Settings" onClick={() => onNavigate('Settings')}><span>⚙</span><b>Settings</b></button>
        <button className="school-card" title="Delhi Public School, Bokaro Steel City" onClick={() => onNotice('Delhi Public School · Bokaro Steel City')}><span className="school-seal">D</span><span className="school-copy"><strong>Delhi Public School</strong><small>Bokaro Steel City</small></span></button>
      </div>
    </aside>
  );
}

function UploadCard({ kind, file, onChoose, onRemove, onPreview }: { kind: UploadKind; file: UploadedFile | null; onChoose: (kind: UploadKind, file: File) => Promise<void>; onRemove: () => void; onPreview: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const label = kind === 'question' ? 'Question Paper' : 'Answer Sheet';

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) await onChoose(kind, selected);
    event.target.value = '';
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) await onChoose(kind, selected);
  };

  return (
    <div className={`upload-card ${file ? 'has-file' : ''} ${dragging ? 'is-dragging' : ''}`} onDragEnter={() => setDragging(true)} onDragLeave={() => setDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={handleFile} hidden />
      {file ? (
        <div className="file-pill">
          <span className={`pdf-icon ${file.mime.startsWith('image/') ? 'image-icon' : ''}`}>{file.mime.startsWith('image/') ? 'IMG' : 'PDF'}</span>
          <button className="file-copy" onClick={onPreview} aria-label={`Preview ${file.name}`}><strong>{file.name}</strong><small>{file.size} · {file.pages} {file.pages === 1 ? 'page' : 'pages'} · Preview</small></button>
          <button className="file-remove" onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
          {file.url && <span className="upload-ready">✓ {file.source === 'demo' ? 'Sample' : 'Ready'}</span>}
        </div>
      ) : (
        <>
          <span className="upload-icon" aria-hidden="true">↥</span>
          <button onClick={() => inputRef.current?.click()}>Upload <em>{label}</em></button>
          <small>PDF, PNG or JPG · up to 25 MB</small>
        </>
      )}
    </div>
  );
}

function UploadScreen({ questionFile, answerFile, chooseFile, removeFile, startMapping, loadDemo, previewFile }: { questionFile: UploadedFile | null; answerFile: UploadedFile | null; chooseFile: (kind: UploadKind, file: File) => Promise<void>; removeFile: (kind: UploadKind) => void; startMapping: () => void; loadDemo: () => void; previewFile: (file: UploadedFile) => void }) {
  return (
    <section className="upload-workspace" aria-labelledby="upload-title">
      <div className="title-block"><h1 id="upload-title">Upload <span>Question Paper &amp; Answer Sheets</span></h1><p>Upload both files to get started</p></div>
      <div className="veda-orbit" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit-dot dot-one">✦</span><span className="orbit-dot dot-two">✦</span><span className="teacher-core"><span>V</span></span></div>
      <div className="upload-tray">
        <UploadCard kind="question" file={questionFile} onChoose={chooseFile} onRemove={() => removeFile('question')} onPreview={() => questionFile && previewFile(questionFile)} />
        <UploadCard kind="answer" file={answerFile} onChoose={chooseFile} onRemove={() => removeFile('answer')} onPreview={() => answerFile && previewFile(answerFile)} />
      </div>
      <button className="mapping-button" disabled={!questionFile || !answerFile} onClick={startMapping}>Start Mapping <span>→</span></button>
      <p className="upload-helper">Questions from the paper will be mapped to the student&apos;s handwritten answers. {!questionFile && !answerFile && <button onClick={loadDemo}>Try sample files</button>}</p>
    </section>
  );
}

function ExtractingScreen({ phase, uploadPct, questionFile, answerFile }: { phase: MappingPhase; uploadPct: number; questionFile: UploadedFile; answerFile: UploadedFile }) {
  const uploading = phase === 'uploading';
  // Determinate width only while uploading (real byte progress). During analysis
  // we have no server-side progress signal, so the bar is honestly indeterminate
  // rather than a fake percentage creeping toward 100.
  return (
    <section className="extracting-panel" aria-live="polite">
      <div className="extracting-content">
        <div className="extract-spark" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div>
        <h1>Extracting…</h1><p>This may take a while</p>
        <div className="processing-files"><span>{questionFile.name}</span><i>↔</i><span>{answerFile.name}</span></div>
        <div className={`progress-track ${uploading ? '' : 'progress-track--indeterminate'}`}><span style={uploading ? { width: `${uploadPct}%` } : undefined} /></div>
        <small>{uploading ? `Uploading documents · ${uploadPct}%` : 'Analyzing answers with AI…'}</small>
      </div>
    </section>
  );
}

function Score({ score, max }: { score: number; max: number }) {
  const ratio = score / max;
  const tone = ratio === 1 ? 'green' : ratio >= 0.5 ? 'amber' : 'red';
  return <span className={`score score--${tone}`}>{score}/{max}</span>;
}

function QuestionCard({ question, selected, expanded, onSelect, onViewAnswer, onUpdate, onSave }: { question: Question; selected: boolean; expanded: boolean; onSelect: () => void; onViewAnswer: () => void; onUpdate: (patch: Partial<Question>) => void; onSave: () => void }) {
  const changeScore = (delta: number) => onUpdate({ score: Math.min(question.max, Math.max(0, Math.round((question.score + delta) * 2) / 2)) });
  const mappingLabel = question.status === 'mapped'
    ? `${Math.round((question.confidence ?? 0) * 100)}% match`
    : question.status === 'not_answered' ? 'Not answered' : 'Check mapping';

  return (
    <article className={`question-card ${selected ? 'question-card--selected' : ''}`}>
      <button className="question-summary" onClick={onSelect} aria-expanded={expanded}>
        <span className="question-number">{question.label ?? question.id}</span><span className="question-text">{question.text}</span>{question.status && <span className={`mapping-confidence mapping-confidence--${question.status}`}>{mappingLabel}</span>}<Score score={question.score} max={question.max} /><span className="chevron">⌄</span>
      </button>
      {expanded && (
        <div className="feedback">
          <span className="feedback-label">✦ AI Feedback · editable by teacher</span>
          <textarea aria-label={`Feedback for question ${question.id}`} value={question.feedback} onChange={(event) => onUpdate({ feedback: event.target.value })} />
          {question.answerText && <details className="answer-transcript"><summary>Matched answer transcript</summary><p>{question.answerText}</p></details>}
          <div className="grading-row">
            <span>Marks awarded</span>
            <div className="mark-stepper"><button onClick={() => changeScore(-0.5)} disabled={question.score === 0} aria-label={`Decrease marks for question ${question.id}`}>−</button><output>{question.score} / {question.max}</output><button onClick={() => changeScore(0.5)} disabled={question.score === question.max} aria-label={`Increase marks for question ${question.id}`}>+</button></div>
          </div>
          <div className="feedback-actions"><button className="view-answer" onClick={onViewAnswer}>View mapped answer <span>→</span></button><button className="save-question" onClick={onSave}>Save changes</button></div>
        </div>
      )}
    </article>
  );
}

function QuestionsPanel({ questions, unmatched, extractionMeta, selected, selectedUnmatched, expandedAll, savedAt, onExpandAll, onSelect, onSelectUnmatched, onViewAnswer, onUpdate, onSave, onComplete }: { questions: Question[]; unmatched: UnmatchedAnswer[]; extractionMeta: ExtractionMeta; selected: number; selectedUnmatched: number | null; expandedAll: boolean; savedAt: string | null; onExpandAll: () => void; onSelect: (id: number) => void; onSelectUnmatched: (id: number) => void; onViewAnswer: (id: number) => void; onUpdate: (id: number, patch: Partial<Question>) => void; onSave: () => void; onComplete: () => void }) {
  const awarded = questions.reduce((total, question) => total + question.score, 0);
  const maximum = questions.reduce((total, question) => total + question.max, 0);

  return (
    <section className="questions-panel" aria-label="Extracted questions">
      <div className="panel-heading">
        <div><h1>Extracted Questions <span>(from question paper)</span></h1><p>{questions.length} questions · {awarded}/{maximum} marks {savedAt ? `· Saved ${savedAt}` : '· Unsaved review'}</p><small className={`extraction-source extraction-source--${extractionMeta.mode}`}><i>✦</i>{extractionMeta.message}</small></div>
        <div className="panel-actions"><button onClick={onExpandAll}>{expandedAll ? 'Collapse All' : 'Expand All'}</button><button className="save-review" onClick={onSave}>Save Review</button><button className="save-review" style={{background: 'var(--ink)'}} onClick={() => window.print()}>Export PDF</button><button className="complete-review" onClick={onComplete}>Complete</button></div>
      </div>
      <div className="question-list">
        {questions.map((question) => <QuestionCard key={question.id} question={question} selected={question.id === selected} expanded={expandedAll || question.id === selected} onSelect={() => onSelect(question.id)} onViewAnswer={() => onViewAnswer(question.id)} onUpdate={(patch) => onUpdate(question.id, patch)} onSave={onSave} />)}
        {unmatched.length > 0 && (
          <div className="unmatched-panel" aria-label="Unmatched answers">
            <div className="unmatched-heading"><strong>Unmatched answers</strong><span>{unmatched.length}</span></div>
            <p className="unmatched-sub">Handwriting VedaAI could not tie to any extracted question. Review before grading.</p>
            {unmatched.map((entry) => (
              <button key={entry.id} className={`unmatched-card ${entry.id === selectedUnmatched ? 'unmatched-card--selected' : ''}`} onClick={() => onSelectUnmatched(entry.id)}>
                <div className="unmatched-card-head"><span className="unmatched-tag">Unmatched</span><span className="unmatched-page">Page {entry.region.page}</span></div>
                {entry.transcript && <p className="unmatched-transcript">{entry.transcript}</p>}
                {entry.note && <small className="unmatched-note">{entry.note}</small>}
                <span className="unmatched-view">View on sheet →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SamplePaper({ selected, page, zoom, questions }: { selected: number; page: number; zoom: number; questions: Question[] }) {
  const start = (page - 1) * 3 + 1;
  const pageQuestions = questions.slice(start - 1, start + 2);
  return (
    <div className="paper" style={{ transform: `scale(${zoom / 100})` }}>
      <div className="paper-top"><span>SCIENCE · CLASS X</span><span>Roll No. 18</span></div><h2>Answer Sheet</h2><div className="student-line"><span>Name: Madhur K.</span><span>Date: 14.08.2026</span></div>
      {pageQuestions.map((question) => <div key={question.id} className={`written-answer ${question.id === selected ? 'written-answer--selected' : ''}`}><span className="mapped-tag">Q{question.id}</span><strong>Q{question.id}.</strong>{answerText[question.id].map((line, index) => <p key={index}>{line}</p>)}{question.id === 2 && <div className="sketch" aria-label="Student sketch"><span>✣</span><i /><i /><i /></div>}</div>)}
      <div className="page-number">{page}</div>
    </div>
  );
}

// Track the *rendered* (layout) pixel size of a media element (img/canvas) and
// keep it current across resize. Highlight boxes are positioned from this live
// size at render time, not from percentages baked in at fetch time — so they
// stay aligned when the viewport or the answer-sheet column resizes. Zoom is a
// CSS transform on an ancestor, which scales the media and its overlays together
// (layout size is unchanged), so no per-zoom recompute is needed.
function useMeasuredSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

// Absolutely-positioned rectangles drawn over the rendered page. Positioned in
// real pixels derived from the measured media size, so a box that the model
// placed at (left%, top%) lands on the same spot of the actual handwriting.
function RegionHighlights({ mediaRef, highlights }: { mediaRef: RefObject<HTMLElement | null>; highlights: Highlight[] }) {
  const size = useMeasuredSize(mediaRef);
  if (size.width === 0 || size.height === 0 || highlights.length === 0) return null;
  return (
    <>
      {highlights.map((highlight, index) => {
        const unmatched = highlight.variant === 'unmatched';
        return (
          <div
            key={index}
            className={`document-highlight ${highlight.variant === 'uncertain' ? 'document-highlight--uncertain' : ''}`}
            style={{
              left: `${(highlight.left / 100) * size.width}px`,
              top: `${(highlight.top / 100) * size.height}px`,
              width: `${(highlight.width / 100) * size.width}px`,
              height: `${(highlight.height / 100) * size.height}px`,
              right: 'auto',
              ...(unmatched ? { borderColor: '#e0564e', borderStyle: 'dashed' as const, background: 'rgb(224 86 78 / 13%)' } : null),
            }}
          >
            {highlight.label && <span style={unmatched ? { background: '#d1483f' } : undefined}>{highlight.label}</span>}
          </div>
        );
      })}
    </>
  );
}

// Wraps a media element so its overlay layer shares the exact same box. The stage
// is a block that the media fills (width:100%, height:auto), so the stage tightly
// wraps the media and percentage/pixel overlays map directly onto it.
const mediaStageStyle: CSSProperties = { position: 'relative', width: '100%', lineHeight: 0 };

function ImageStage({ src, name, page, highlights }: { src: string; name: string; page: number; highlights: Highlight[] }) {
  const imageRef = useRef<HTMLImageElement>(null);
  return (
    <div className="media-stage" style={mediaStageStyle}>
      <img ref={imageRef} src={src} alt={`Uploaded answer sheet: ${name}, page ${page}`} />
      <RegionHighlights mediaRef={imageRef} highlights={highlights} />
    </div>
  );
}

function PdfPageCanvas({ file, page, zoom, fallbackUrl, highlights }: { file: File; page: number; zoom: number; fallbackUrl: string; highlights: Highlight[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | undefined;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setFailed(true);
        void loadingTask?.destroy();
      }
    }, 8000);

    const renderPage = async () => {
      try {
        setRendering(true);
        setFailed(false);
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        loadingTask = task;
        const document = await task.promise;
        const pdfPage = await document.getPage(Math.min(page, document.numPages));
        const viewport = pdfPage.getViewport({ scale: 1.45 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context || cancelled) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
        pdfPage.cleanup();
        await task.destroy();
        if (!cancelled) setRendering(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      void loadingTask?.destroy();
    };
  }, [file, page, zoom]);

  // Native-PDF fallback can't host a pixel-accurate overlay, so highlights are
  // omitted there (the canvas path above is the accurate one).
  if (failed) return <object data={`${fallbackUrl}#page=${page}&zoom=${zoom}`} type="application/pdf" aria-label={`Uploaded PDF answer sheet, page ${page}`}><p>Your browser cannot preview this PDF.</p></object>;
  return (
    <div className="media-stage" style={mediaStageStyle}>
      {rendering && <span className="pdf-rendering-note" style={{ position: 'absolute', top: 8, left: 8, color: '#8f8a84', fontSize: '10.5px', zIndex: 2 }}>Rendering page {page}…</span>}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} aria-label={`Uploaded PDF answer sheet, page ${page}`} />
      <RegionHighlights mediaRef={canvasRef} highlights={highlights} />
    </div>
  );
}

function UploadedDocument({ file, question, unmatched, page, zoom }: { file: UploadedFile; question: Question; unmatched: UnmatchedAnswer | null; page: number; zoom: number }) {
  const source = file.url ?? '';
  const pageRendered = file.mime.startsWith('image/') || Boolean(file.rawFile && file.mime === 'application/pdf');
  const variant: Highlight['variant'] = question.status === 'uncertain' ? 'uncertain' : 'mapped';

  // Highlights for the page currently shown: the selected question's region(s)
  // on this page, plus a selected unmatched answer if it lives on this page.
  const highlights: Highlight[] = (question.regions ?? [])
    .filter((region) => region.page === page)
    .map((region, index) => ({
      ...region,
      variant,
      label: index === 0 ? `Q${question.label ?? question.id} · ${Math.round((question.confidence ?? 0) * 100)}% match` : '',
    }));

  if (unmatched && unmatched.region.page === page) {
    highlights.push({ ...unmatched.region, variant: 'unmatched', label: 'Unmatched answer' });
  }

  return (
    <div className={`uploaded-document ${pageRendered ? 'uploaded-document--page' : ''}`} style={pageRendered ? { transform: `scale(${zoom / 100})` } : undefined}>
      {file.mime.startsWith('image/')
        ? <ImageStage src={source} name={file.name} page={page} highlights={highlights} />
        : file.rawFile
          ? <PdfPageCanvas file={file.rawFile} page={page} zoom={zoom} fallbackUrl={source} highlights={highlights} />
          : <object key={source} data={`${source}#page=${page}&zoom=${zoom}`} type="application/pdf" aria-label={`Uploaded answer sheet: ${file.name}`}><p>Your browser cannot preview this PDF.</p></object>}
      {question.status === 'not_answered' && highlights.length === 0 && <div className="unanswered-state"><span>○</span><strong>No answer detected</strong><small>Confirm against the sheet before grading.</small></div>}
    </div>
  );
}

function AnswerSheet({ answerFile, questions, selected, selectedUnmatched, page, zoom, onPage, onZoom }: { answerFile: UploadedFile; questions: Question[]; selected: number; selectedUnmatched: UnmatchedAnswer | null; page: number; zoom: number; onPage: (page: number) => void; onZoom: (zoom: number) => void }) {
  const totalPages = Math.max(answerFile.pages, 1);
  const isUploaded = Boolean(answerFile.url);
  const selectedQuestion = questions.find((question) => question.id === selected) ?? questions[0];

  return (
    <section className="answer-panel" aria-label="Answer sheet">
      <div className="answer-toolbar">
        <div className="answer-file-title"><strong>Answer Sheet</strong><small>{answerFile.name}</small></div>
        <div className="viewer-actions">
          <div className="zoom-control"><button onClick={() => onZoom(Math.max(75, zoom - 25))} disabled={zoom === 75} aria-label="Zoom out">−</button><span>{zoom}%</span><button onClick={() => onZoom(Math.min(150, zoom + 25))} disabled={zoom === 150} aria-label="Zoom in">+</button></div>
          <div className="page-control"><button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">‹</button><span>Page {page} of {totalPages}</span><button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page">›</button></div>
        </div>
      </div>
      <div className={`paper-viewport ${isUploaded ? 'paper-viewport--uploaded' : ''}`}>{isUploaded && selectedQuestion ? <UploadedDocument file={answerFile} question={selectedQuestion} unmatched={selectedUnmatched} page={page} zoom={zoom} /> : <SamplePaper selected={selected} page={page} zoom={zoom} questions={questions} />}</div>
    </section>
  );
}

function ResultsScreen({ answerFile, questions, unmatched, extractionMeta, selected, savedAt, onSelected, onUpdate, onSave, onComplete }: { answerFile: UploadedFile; questions: Question[]; unmatched: UnmatchedAnswer[]; extractionMeta: ExtractionMeta; selected: number; savedAt: string | null; onSelected: (id: number) => void; onUpdate: (id: number, patch: Partial<Question>) => void; onSave: () => void; onComplete: () => void }) {
  const [tab, setTab] = useState<MobileTab>('questions');
  const [expandedAll, setExpandedAll] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);
  const [selectedUnmatched, setSelectedUnmatched] = useState<number | null>(null);

  const selectQuestion = (id: number) => {
    onSelected(id);
    setSelectedUnmatched(null);
    const question = questions.find((item) => item.id === id);
    const firstRegion = question?.regions?.[0];
    if (firstRegion) {
      setPage(Math.min(answerFile.pages, firstRegion.page));
    } else {
      const questionsPerPage = Math.max(1, Math.ceil(questions.length / answerFile.pages));
      setPage(Math.min(answerFile.pages, Math.ceil(id / questionsPerPage)));
    }
  };

  const selectUnmatched = (id: number) => {
    setSelectedUnmatched(id);
    const entry = unmatched.find((item) => item.id === id);
    if (entry) setPage(Math.min(answerFile.pages, entry.region.page));
    setTab('answer');
  };

  const activeUnmatched = unmatched.find((item) => item.id === selectedUnmatched) ?? null;

  return (
    <div className="results-workspace">
      <div className="mobile-tabs" role="tablist"><button role="tab" aria-selected={tab === 'questions'} className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>Questions</button><button role="tab" aria-selected={tab === 'answer'} className={tab === 'answer' ? 'active' : ''} onClick={() => setTab('answer')}>Answer Sheet</button></div>
      <div className={`result-column result-column--questions ${tab === 'questions' ? 'mobile-active' : ''}`}><QuestionsPanel questions={questions} unmatched={unmatched} extractionMeta={extractionMeta} selected={selected} selectedUnmatched={selectedUnmatched} expandedAll={expandedAll} savedAt={savedAt} onExpandAll={() => setExpandedAll(!expandedAll)} onSelect={selectQuestion} onSelectUnmatched={selectUnmatched} onViewAnswer={(id) => { selectQuestion(id); setTab('answer'); }} onUpdate={onUpdate} onSave={onSave} onComplete={onComplete} /></div>
      <div className={`result-column result-column--answer ${tab === 'answer' ? 'mobile-active' : ''}`}><AnswerSheet answerFile={answerFile} questions={questions} selected={selected} selectedUnmatched={activeUnmatched} page={page} zoom={zoom} onPage={setPage} onZoom={setZoom} /></div>
      <button className="mobile-view-fab" onClick={() => setTab(tab === 'questions' ? 'answer' : 'questions')}>{tab === 'questions' ? 'View highlighted answer →' : '← Back to questions'}</button>
    </div>
  );
}

function DocumentPreviewModal({ file, onClose }: { file: UploadedFile; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="document-modal" role="dialog" aria-modal="true" aria-label={`Preview ${file.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><strong>{file.name}</strong><small>{file.size} · {file.pages} {file.pages === 1 ? 'page' : 'pages'}</small></div><button aria-label="Close preview" onClick={onClose}>×</button></header>
        <div className="document-modal-body">{file.url ? file.mime.startsWith('image/') ? <img src={file.url} alt={file.name} /> : <object data={file.url} type="application/pdf" aria-label={file.name}><p>Your browser cannot preview this PDF.</p></object> : <div className="demo-preview"><span>✦</span><strong>VedaAI sample document</strong><p>This built-in sample becomes an interactive answer sheet after mapping.</p></div>}</div>
      </section>
    </div>
  );
}

function CompleteDialog({ questions, onClose, onConfirm }: { questions: Question[]; onClose: () => void; onConfirm: () => void }) {
  const awarded = questions.reduce((sum, question) => sum + question.score, 0);
  const maximum = questions.reduce((sum, question) => sum + question.max, 0);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="complete-dialog" role="dialog" aria-modal="true" aria-label="Complete assessment review" onMouseDown={(event) => event.stopPropagation()}>
        <span className="complete-icon">✓</span><h2>Complete this review?</h2><p>You&apos;ve reviewed {questions.length} mapped answers and awarded <strong>{awarded} out of {maximum}</strong> marks.</p><div><button onClick={onClose}>Keep reviewing</button><button className="confirm-complete" onClick={onConfirm}>Complete review</button></div>
      </section>
    </div>
  );
}

function Intro() {
  return <div className="brand-intro" aria-hidden="true"><div className="intro-mark"><span>V</span><i>✦</i><i>✦</i><i>✦</i></div><strong>VedaAI</strong><small>AI that understands your classroom</small></div>;
}

// Downscale/recompress a photo before it ever hits the network: phone photos are
// 2–4 MB, which is slow to send, slow for the model to read, and risks Vercel's
// ~4.5 MB request-body limit. We cap the longest side at 1600 px and re-encode as
// JPEG q0.8. SVG and PDF are left untouched. Any failure falls back to the original.
const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.8;

async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  try {
    // `from-image` bakes in EXIF orientation so rotated phone photos map correctly.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return file; }
    context.fillStyle = '#ffffff'; // flatten any transparency (JPEG has no alpha)
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY));
    if (!blob || blob.size >= file.size) return file; // never inflate an already-small image
    return new File([blob], file.name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function inspectFile(rawInput: File): Promise<UploadedFile> {
  if (rawInput.size > MAX_FILE_SIZE) throw new Error('File is larger than 25 MB. Choose a smaller document.');
  const inputMime = rawInput.type || (rawInput.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
  if (inputMime !== 'application/pdf' && !inputMime.startsWith('image/')) throw new Error('Unsupported file. Upload a PDF, PNG, JPG or WEBP document.');

  const file = await downscaleImage(rawInput);
  const mime = file.type || inputMime;

  let pages = 1;
  if (mime === 'application/pdf') {
    // Keep uploads responsive even when the browser cannot start PDF.js workers.
    // This lightweight count is corrected by the full extraction result later.
    const source = new TextDecoder('latin1').decode(await file.arrayBuffer());
    pages = Math.max(1, Math.min(source.match(/\/Type\s*\/Page\b/g)?.length ?? 1, 99));
  }

  return { name: file.name, size: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`, pages, mime, source: 'uploaded', url: URL.createObjectURL(file), rawFile: file };
}

type MappingProgress = {
  // 0–1 fraction of bytes uploaded (real signal from the XHR upload stream).
  onUploadProgress: (fraction: number) => void;
  // Fired once the request body is fully sent and the server starts analysing.
  onUploaded: () => void;
};

// Uses XMLHttpRequest (not fetch) specifically because it exposes real upload
// progress events, which drive the genuine "Uploading" phase of the progress bar.
function mapAssessmentWithAi(questionPaper: File, answerSheet: File, progress: MappingProgress): Promise<AssessmentMappingResponse> {
  const formData = new FormData();
  formData.append('questionPaper', questionPaper);
  formData.append('answerSheet', answerSheet);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/map-assessment');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress.onUploadProgress(event.loaded / event.total);
    };
    xhr.upload.onload = () => {
      progress.onUploadProgress(1);
      progress.onUploaded();
    };

    xhr.onload = () => {
      let payload: AssessmentMappingResponse & { error?: string; code?: string };
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error('The AI service returned an unreadable response.'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
      } else {
        const error = new Error(payload.error || 'AI mapping could not be completed.') as Error & { code?: string };
        error.code = payload.code;
        reject(error);
      }
    };
    xhr.onerror = () => reject(new Error('Network error while contacting the AI service.'));

    xhr.send(formData);
  });
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [questionFile, setQuestionFile] = useState<UploadedFile | null>(null);
  const [answerFile, setAnswerFile] = useState<UploadedFile | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase] = useState<MappingPhase>('uploading');
  const [selected, setSelected] = useState(2);
  const [showIntro, setShowIntro] = useState(true);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [unmatched, setUnmatched] = useState<UnmatchedAnswer[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const [extractionMeta, setExtractionMeta] = useState<ExtractionMeta>({ pageCount: 4, characterCount: 0, mode: 'demo', message: 'VedaAI sample assessment · mapped for demonstration' });
  const mappingRun = useRef(0);

  const awardedMarks = useMemo(() => questions.reduce((sum, question) => sum + question.score, 0), [questions]);
  const maximumMarks = useMemo(() => questions.reduce((sum, question) => sum + question.max, 0), [questions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 1250);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const chooseFile = async (kind: UploadKind, file: File) => {
    try {
      const next = await inspectFile(file);
      const current = kind === 'question' ? questionFile : answerFile;
      if (current?.url) URL.revokeObjectURL(current.url);
      if (kind === 'question') setQuestionFile(next); else setAnswerFile(next);
      setNotice(`${kind === 'question' ? 'Question paper' : 'Answer sheet'} ready to map.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to read this file.');
    }
  };

  const removeFile = (kind: UploadKind) => {
    const current = kind === 'question' ? questionFile : answerFile;
    if (current?.url) URL.revokeObjectURL(current.url);
    if (kind === 'question') setQuestionFile(null); else setAnswerFile(null);
    setNotice(`${kind === 'question' ? 'Question paper' : 'Answer sheet'} removed.`);
  };

  const loadDemo = async () => {
    try {
      setNotice('Loading the VedaAI sample assessment...');
      const [questionResponse, answerResponse] = await Promise.all([
        fetch('/samples/vedaai-question-paper.pdf'),
        fetch('/samples/vedaai-answer-sheet.svg'),
      ]);
      if (!questionResponse.ok || !answerResponse.ok) throw new Error('Sample document request failed.');
      const [questionBlob, answerBlob] = await Promise.all([questionResponse.blob(), answerResponse.blob()]);
      const [sampleQuestion, sampleAnswer] = await Promise.all([
        inspectFile(new File([questionBlob], 'VedaAI_Science_Question_Paper.pdf', { type: 'application/pdf' })),
        inspectFile(new File([answerBlob], 'VedaAI_Demo_Answer_Sheet.svg', { type: 'image/svg+xml' })),
      ]);
      setQuestionFile({ ...sampleQuestion, source: 'demo' });
      setAnswerFile({ ...sampleAnswer, source: 'demo' });
      setNotice('Sample question paper and answer sheet loaded. Start mapping when ready.');
    } catch {
      setNotice('The sample documents could not be loaded. Please upload your own files.');
    }
  };

  const beginMapping = async () => {
    if (!questionFile || !answerFile) return;
    const runId = ++mappingRun.current;
    const startedAt = Date.now();
    setUploadPct(0);
    setPhase(questionFile.source === 'demo' ? 'processing' : 'uploading');
    setScreen('extracting');
    setSavedAt(null);

    let nextQuestions = questions;
    let nextUnmatched: UnmatchedAnswer[] = [];
    let nextMeta: ExtractionMeta = { pageCount: questionFile.pages, characterCount: 0, mode: 'demo', message: 'VedaAI sample assessment · mapped for demonstration' };

    if (questionFile.source === 'demo') {
      nextQuestions = sampleQuestions;
      nextMeta = { pageCount: questionFile.pages, characterCount: 333, mode: 'ai', message: `${sampleQuestions.length} questions and answers matched · average confidence 99%.` };
    } else if (questionFile.rawFile && answerFile.rawFile) {
      try {
        const result = await mapAssessmentWithAi(questionFile.rawFile, answerFile.rawFile, {
          onUploadProgress: (fraction) => { if (mappingRun.current === runId) setUploadPct(Math.round(fraction * 100)); },
          onUploaded: () => { if (mappingRun.current === runId) setPhase('processing'); },
        });
        nextQuestions = result.questions;
        nextUnmatched = result.unmatchedAnswers;
        const mappedCount = result.questions.filter((question) => question.status === 'mapped').length;
        const averageConfidence = result.questions.reduce((sum, question) => sum + question.confidence, 0) / (result.questions.length || 1);
        nextMeta = {
          pageCount: questionFile.pages,
          characterCount: result.questions.reduce((sum, question) => sum + question.answerText.length, 0),
          mode: 'ai',
          message: `${mappedCount}/${result.questions.length} answers matched by AI · ${Math.round(averageConfidence * 100)}% average confidence${result.unmatchedAnswers.length ? ` · ${result.unmatchedAnswers.length} unmatched` : ''}.`,
        };
        setAnswerFile((current) => current ? { ...current, pages: result.answerPageCount } : current);
      } catch (aiError) {
        const reason = aiError instanceof Error ? aiError.message : 'AI mapping was unavailable.';
        const code = (aiError as { code?: string })?.code;
        // A missing/unconfigured API key is an environment error, not a successful
        // extraction. Surface it clearly instead of fabricating placeholder questions.
        if (code === 'AI_NOT_CONFIGURED') {
          if (mappingRun.current === runId) {
            setScreen('upload');
            setUploadPct(0);
            setNotice(reason);
          }
          return;
        }
        if (questionFile.mime === 'application/pdf') {
          try {
            const result = await Promise.race([
              extractQuestionsFromPdf(questionFile.rawFile),
              new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('PDF extraction timed out.')), 6500)),
            ]);
            const { questions: extracted, ...meta } = result;
            nextMeta = { ...meta, mode: 'fallback', message: `${reason} Questions were extracted locally, but answer matches need verification.` };
            nextQuestions = extracted.length >= 2 ? extracted : createVerificationQuestions(meta.pageCount);
          } catch {
            nextQuestions = createVerificationQuestions(questionFile.pages);
            nextMeta = { pageCount: questionFile.pages, characterCount: 0, mode: 'fallback', message: `${reason} Verify the question placeholders before grading.` };
          }
        } else {
          nextQuestions = createVerificationQuestions(questionFile.pages);
          nextMeta = { pageCount: questionFile.pages, characterCount: 0, mode: 'fallback', message: `${reason} Image questions and answer matches need verification.` };
        }
      }
    }

    // Real work is already done; keep a short floor only so the "processing"
    // state doesn't flash by (mainly for the instant demo path).
    const remainingDelay = Math.max(500, 1400 - (Date.now() - startedAt));
    window.setTimeout(() => {
      if (mappingRun.current !== runId) return;
      setQuestions(nextQuestions);
      setUnmatched(nextUnmatched);
      setSelected(nextQuestions.find((question) => question.status === 'mapped')?.id ?? nextQuestions[0]?.id ?? 1);
      setExtractionMeta(nextMeta);
      setScreen('results');
    }, remainingDelay);
  };

  const saveReview = (message = 'Review saved for this session.') => {
    const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
    setSavedAt(time);
    setNotice(message);
  };

  const completeReview = () => {
    saveReview(`Review completed · ${awardedMarks}/${maximumMarks} marks awarded.`);
    setShowComplete(false);
  };

  const goBack = () => {
    if (screen === 'upload') { setNotice('You are at the beginning of the assessment flow.'); return; }
    mappingRun.current += 1;
    setScreen('upload');
    setUploadPct(0);
    setPhase('uploading');
  };

  const navigate = (label: string) => {
    if (label === 'Exams') {
      setScreen('upload');
      return;
    }
    setNotice(`${label} is outside this assessment mapping demo.`);
  };

  return (
    <>
      {showIntro && <Intro />}
      <main className={`app-shell app-shell--${screen}`}>
        <Sidebar compact={screen !== 'upload'} onNotice={setNotice} onNavigate={navigate} />
        <div className="app-main">
          <Header screen={screen} onBack={goBack} onNavigate={navigate} />
          {screen === 'upload' && <UploadScreen questionFile={questionFile} answerFile={answerFile} chooseFile={chooseFile} removeFile={removeFile} startMapping={beginMapping} loadDemo={loadDemo} previewFile={setPreviewFile} />}
          {screen === 'extracting' && questionFile && answerFile && <ExtractingScreen phase={phase} uploadPct={uploadPct} questionFile={questionFile} answerFile={answerFile} />}
          {screen === 'results' && answerFile && <ResultsScreen answerFile={answerFile} questions={questions} unmatched={unmatched} extractionMeta={extractionMeta} selected={selected} savedAt={savedAt} onSelected={setSelected} onUpdate={(id, patch) => setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question))} onSave={() => saveReview()} onComplete={() => setShowComplete(true)} />}
        </div>
      </main>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
      {previewFile && <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {showComplete && <CompleteDialog questions={questions} onClose={() => setShowComplete(false)} onConfirm={completeReview} />}
    </>
  );
}
