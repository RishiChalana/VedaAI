'use client';

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type UploadKind = 'question' | 'answer';
type Screen = 'upload' | 'extracting' | 'results';
type MobileTab = 'questions' | 'answer';
type HeaderPanel = 'help' | 'notifications' | 'profile' | null;

type UploadedFile = {
  name: string;
  size: string;
  pages: number;
  mime: string;
  source: 'uploaded' | 'demo';
  url?: string;
};

type Question = {
  id: number;
  text: string;
  max: number;
  score: number;
  feedback: string;
};

const REVIEW_STORAGE_KEY = 'vedaai-assessment-review-v1';
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

function Header({ screen, onBack, onNotice }: { screen: Screen; onBack: () => void; onNotice: (message: string) => void }) {
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const togglePanel = (next: HeaderPanel) => setPanel(panel === next ? null : next);

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button back-button" aria-label="Go back" onClick={onBack}>←</button>
          <span className="page-crumb">{screen === 'results' ? 'Assessment review' : 'Exams'}</span>
        </div>
        <div className="mobile-brand"><VedaMark /></div>
        <div className="topbar-actions">
          <button className="icon-button desktop-only" aria-label="Help" onClick={() => togglePanel('help')}>?</button>
          <button className="icon-button notification" aria-label="Notifications" onClick={() => togglePanel('notifications')}>♢<span /></button>
          <span className="spark-mini" aria-hidden="true">✦</span>
          <button className="profile-button" aria-label="Open profile" onClick={() => togglePanel('profile')}>
            <span className="avatar">MR</span>
            <span className="profile-copy desktop-only"><strong>Madhur Khang</strong><small>Teacher</small></span>
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
          {panel === 'profile' && <><span className="popover-icon popover-avatar">MR</span><strong>Madhur Khang</strong><p>Teacher · Delhi Public School</p><button className="popover-action" onClick={() => { setPanel(null); onNotice('Profile settings are outside this assignment flow.'); }}>View profile</button></>}
        </div>
      )}

      {mobileMenu && (
        <div className="mobile-menu" role="dialog" aria-label="Mobile navigation">
          {navItems.map(([icon, label]) => <button key={label} className={label === 'Exams' ? 'active' : ''} onClick={() => { setMobileMenu(false); onNotice(label === 'Exams' ? 'You are already in Exams.' : `${label} is outside this assignment flow.`); }}><span>{icon}</span>{label}</button>)}
        </div>
      )}
    </>
  );
}

function Sidebar({ compact, onNotice }: { compact: boolean; onNotice: (message: string) => void }) {
  return (
    <aside className={`sidebar ${compact ? 'sidebar--compact' : ''}`}>
      <VedaMark compact={compact} />
      <button className="toolkit-button" aria-label="AI Teacher's Toolkit" onClick={() => onNotice('Assessment Mapper is part of the AI Teacher’s Toolkit.')}><span>✦</span><b>AI Teacher&apos;s Toolkit</b></button>
      <nav aria-label="Primary navigation">
        {navItems.map(([icon, label]) => <button key={label} className={label === 'Exams' ? 'active' : ''} title={label} onClick={() => onNotice(label === 'Exams' ? 'You are already in Exams.' : `${label} is outside this assignment flow.`)}><span className="nav-icon">{icon}</span><b>{label}</b></button>)}
      </nav>
      <div className="sidebar-footer">
        <button className="settings" title="Settings" onClick={() => onNotice('Settings are outside this assignment flow.')}><span>⚙</span><b>Settings</b></button>
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
          {file.source === 'uploaded' && <span className="upload-ready">✓ Ready</span>}
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

function ExtractingScreen({ progress, questionFile, answerFile }: { progress: number; questionFile: UploadedFile; answerFile: UploadedFile }) {
  const label = progress < 30 ? 'Reading both documents' : progress < 65 ? 'Detecting question structure' : progress < 90 ? 'Matching handwritten answers' : 'Preparing teacher review';
  return (
    <section className="extracting-panel" aria-live="polite">
      <div className="extracting-content">
        <div className="extract-spark" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div>
        <h1>Extracting...</h1><p>This may take a while</p>
        <div className="processing-files"><span>{questionFile.name}</span><i>↔</i><span>{answerFile.name}</span></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <small>{label} · {progress}%</small>
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

  return (
    <article className={`question-card ${selected ? 'question-card--selected' : ''}`}>
      <button className="question-summary" onClick={onSelect} aria-expanded={expanded}>
        <span className="question-number">{question.id}</span><span className="question-text">{question.text}</span><Score score={question.score} max={question.max} /><span className="chevron">⌄</span>
      </button>
      {expanded && (
        <div className="feedback">
          <span className="feedback-label">✦ AI Feedback · editable by teacher</span>
          <textarea aria-label={`Feedback for question ${question.id}`} value={question.feedback} onChange={(event) => onUpdate({ feedback: event.target.value })} />
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

function QuestionsPanel({ questions, selected, expandedAll, savedAt, onExpandAll, onSelect, onViewAnswer, onUpdate, onSave, onComplete }: { questions: Question[]; selected: number; expandedAll: boolean; savedAt: string | null; onExpandAll: () => void; onSelect: (id: number) => void; onViewAnswer: (id: number) => void; onUpdate: (id: number, patch: Partial<Question>) => void; onSave: () => void; onComplete: () => void }) {
  const awarded = questions.reduce((total, question) => total + question.score, 0);
  const maximum = questions.reduce((total, question) => total + question.max, 0);

  return (
    <section className="questions-panel" aria-label="Extracted questions">
      <div className="panel-heading">
        <div><h1>Extracted Questions <span>(from question paper)</span></h1><p>{questions.length} questions · {awarded}/{maximum} marks {savedAt ? `· Saved ${savedAt}` : '· Unsaved review'}</p></div>
        <div className="panel-actions"><button onClick={onExpandAll}>{expandedAll ? 'Collapse All' : 'Expand All'}</button><button className="save-review" onClick={onSave}>Save Review</button><button className="complete-review" onClick={onComplete}>Complete</button></div>
      </div>
      <div className="question-list">
        {questions.map((question) => <QuestionCard key={question.id} question={question} selected={question.id === selected} expanded={expandedAll || question.id === selected} onSelect={() => onSelect(question.id)} onViewAnswer={() => onViewAnswer(question.id)} onUpdate={(patch) => onUpdate(question.id, patch)} onSave={onSave} />)}
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

function UploadedDocument({ file, selected, page, zoom }: { file: UploadedFile; selected: number; page: number; zoom: number }) {
  const row = (selected - 1) % 3;
  const isMappedPage = Math.ceil(selected / 3) === page;
  const source = file.url ? `${file.url}${file.mime === 'application/pdf' ? `#page=${page}&zoom=${zoom}` : ''}` : '';
  return (
    <div className="uploaded-document" style={file.mime.startsWith('image/') ? { transform: `scale(${zoom / 100})` } : undefined}>
      {file.mime.startsWith('image/') ? <img src={source} alt={`Uploaded answer sheet: ${file.name}`} /> : <object key={source} data={source} type="application/pdf" aria-label={`Uploaded answer sheet: ${file.name}`}><p>Your browser cannot preview this PDF.</p></object>}
      {isMappedPage && <div className="document-highlight" style={{ top: `${18 + row * 27}%` }}><span>Q{selected} · AI mapped region</span></div>}
    </div>
  );
}

function AnswerSheet({ answerFile, questions, selected, page, zoom, onPage, onZoom }: { answerFile: UploadedFile; questions: Question[]; selected: number; page: number; zoom: number; onPage: (page: number) => void; onZoom: (zoom: number) => void }) {
  const totalPages = Math.max(answerFile.pages, 1);
  const isUploaded = answerFile.source === 'uploaded' && Boolean(answerFile.url);

  return (
    <section className="answer-panel" aria-label="Answer sheet">
      <div className="answer-toolbar">
        <div className="answer-file-title"><strong>Answer Sheet</strong><small>{answerFile.name}</small></div>
        <div className="viewer-actions">
          <div className="zoom-control"><button onClick={() => onZoom(Math.max(75, zoom - 25))} disabled={zoom === 75} aria-label="Zoom out">−</button><span>{zoom}%</span><button onClick={() => onZoom(Math.min(150, zoom + 25))} disabled={zoom === 150} aria-label="Zoom in">+</button></div>
          <div className="page-control"><button onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page">‹</button><span>Page {page} of {totalPages}</span><button onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page">›</button></div>
        </div>
      </div>
      <div className={`paper-viewport ${isUploaded ? 'paper-viewport--uploaded' : ''}`}>{isUploaded ? <UploadedDocument file={answerFile} selected={selected} page={page} zoom={zoom} /> : <SamplePaper selected={selected} page={page} zoom={zoom} questions={questions} />}</div>
    </section>
  );
}

function ResultsScreen({ answerFile, questions, selected, savedAt, onSelected, onUpdate, onSave, onComplete }: { answerFile: UploadedFile; questions: Question[]; selected: number; savedAt: string | null; onSelected: (id: number) => void; onUpdate: (id: number, patch: Partial<Question>) => void; onSave: () => void; onComplete: () => void }) {
  const [tab, setTab] = useState<MobileTab>('questions');
  const [expandedAll, setExpandedAll] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [page, setPage] = useState(1);

  const selectQuestion = (id: number) => {
    onSelected(id);
    setPage(Math.min(answerFile.pages, Math.ceil(id / 3)));
  };

  return (
    <div className="results-workspace">
      <div className="mobile-tabs" role="tablist"><button role="tab" aria-selected={tab === 'questions'} className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>Questions</button><button role="tab" aria-selected={tab === 'answer'} className={tab === 'answer' ? 'active' : ''} onClick={() => setTab('answer')}>Answer Sheet</button></div>
      <div className={`result-column result-column--questions ${tab === 'questions' ? 'mobile-active' : ''}`}><QuestionsPanel questions={questions} selected={selected} expandedAll={expandedAll} savedAt={savedAt} onExpandAll={() => setExpandedAll(!expandedAll)} onSelect={selectQuestion} onViewAnswer={(id) => { selectQuestion(id); setTab('answer'); }} onUpdate={onUpdate} onSave={onSave} onComplete={onComplete} /></div>
      <div className={`result-column result-column--answer ${tab === 'answer' ? 'mobile-active' : ''}`}><AnswerSheet answerFile={answerFile} questions={questions} selected={selected} page={page} zoom={zoom} onPage={setPage} onZoom={setZoom} /></div>
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

async function inspectFile(file: File): Promise<UploadedFile> {
  if (file.size > MAX_FILE_SIZE) throw new Error('File is larger than 25 MB. Choose a smaller document.');
  const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
  if (mime !== 'application/pdf' && !mime.startsWith('image/')) throw new Error('Unsupported file. Upload a PDF, PNG, JPG or WEBP document.');

  let pages = 1;
  if (mime === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(buffer);
    const detected = text.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    pages = Math.max(1, Math.min(detected || 1, 99));
  }

  return { name: file.name, size: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`, pages, mime, source: 'uploaded', url: URL.createObjectURL(file) };
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [questionFile, setQuestionFile] = useState<UploadedFile | null>(null);
  const [answerFile, setAnswerFile] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState(2);
  const [showIntro, setShowIntro] = useState(true);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  const awardedMarks = useMemo(() => questions.reduce((sum, question) => sum + question.score, 0), [questions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntro(false), 1250);
    const saved = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { questions?: Question[]; savedAt?: string };
        if (Array.isArray(parsed.questions) && parsed.questions.length === initialQuestions.length) setQuestions(parsed.questions);
        if (parsed.savedAt) setSavedAt(parsed.savedAt);
      } catch {
        window.localStorage.removeItem(REVIEW_STORAGE_KEY);
      }
    }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (screen !== 'extracting') return;
    setProgress(8);
    const ticks: Array<[number, number]> = [[450, 28], [1050, 51], [1700, 74], [2300, 91], [2850, 100]];
    const timers = ticks.map(([delay, value]) => window.setTimeout(() => setProgress(value), delay));
    timers.push(window.setTimeout(() => setScreen('results'), 3300));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [screen]);

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

  const loadDemo = () => {
    setQuestionFile({ name: 'Class_10_Science.pdf', size: '1.8 MB', pages: 4, mime: 'application/pdf', source: 'demo' });
    setAnswerFile({ name: 'Madhur_Answer_Sheet.pdf', size: '2.4 MB', pages: 4, mime: 'application/pdf', source: 'demo' });
    setNotice('Sample assessment loaded. Start mapping when ready.');
  };

  const saveReview = (message = 'Review saved on this device.') => {
    const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date());
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ questions, savedAt: time }));
    setSavedAt(time);
    setNotice(message);
  };

  const completeReview = () => {
    saveReview(`Review completed · ${awardedMarks}/40 marks awarded.`);
    setShowComplete(false);
  };

  const goBack = () => {
    if (screen === 'upload') { setNotice('You are at the beginning of the assessment flow.'); return; }
    setScreen('upload');
    setProgress(0);
  };

  return (
    <>
      {showIntro && <Intro />}
      <main className={`app-shell app-shell--${screen}`}>
        <Sidebar compact={screen !== 'upload'} onNotice={setNotice} />
        <div className="app-main">
          <Header screen={screen} onBack={goBack} onNotice={setNotice} />
          {screen === 'upload' && <UploadScreen questionFile={questionFile} answerFile={answerFile} chooseFile={chooseFile} removeFile={removeFile} startMapping={() => questionFile && answerFile && setScreen('extracting')} loadDemo={loadDemo} previewFile={setPreviewFile} />}
          {screen === 'extracting' && questionFile && answerFile && <ExtractingScreen progress={progress} questionFile={questionFile} answerFile={answerFile} />}
          {screen === 'results' && answerFile && <ResultsScreen answerFile={answerFile} questions={questions} selected={selected} savedAt={savedAt} onSelected={setSelected} onUpdate={(id, patch) => setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question))} onSave={() => saveReview()} onComplete={() => setShowComplete(true)} />}
        </div>
      </main>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
      {previewFile && <DocumentPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      {showComplete && <CompleteDialog questions={questions} onClose={() => setShowComplete(false)} onConfirm={completeReview} />}
    </>
  );
}
