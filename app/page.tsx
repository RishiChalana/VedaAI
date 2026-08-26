'use client';

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

type UploadKind = 'question' | 'answer';
type Screen = 'upload' | 'extracting' | 'results';
type MobileTab = 'questions' | 'answer';
type UploadedFile = { name: string; size: string; pages: number };
type Question = { id: number; text: string; max: number; score: number; feedback: string };

const navItems = [['⌂','Home'],['▦','My Classroom'],['✓','Assignments'],['▤','Exams'],['◇','My Library']];
const questions: Question[] = [
  { id:1, text:'What does natural selection mean? How has it contributed to evolution?', max:3, score:3, feedback:'Clear definition with a relevant link to survival and reproduction.' },
  { id:2, text:'What is the following organism commonly mistaken for? Identify it.', max:2, score:1.5, feedback:'The organism is identified correctly. Add one distinguishing feature to earn full marks.' },
  { id:3, text:'Explain the role of chloroplasts in photosynthesis, naming the main pigments involved.', max:4, score:4, feedback:'Accurate explanation of chlorophyll and light-energy conversion.' },
  { id:4, text:'Describe the flow of blood through the human heart starting from the right atrium.', max:5, score:3.5, feedback:'The sequence is mostly correct, but the pulmonary vein is missing.' },
  { id:5, text:'Give a labelled diagram of an animal cell showing at least four organelles.', max:4, score:4, feedback:'Well-labelled diagram with the required organelles.' },
  { id:6, text:'How is asexual reproduction different from sexual reproduction?', max:3, score:2, feedback:'Good comparison. Include genetic variation for a complete answer.' },
  { id:7, text:'Describe reflex action and illustrate the reflex arc with an example.', max:4, score:3, feedback:'Correct pathway and example; the role of the relay neuron needs clarification.' },
  { id:8, text:'Explain how the structure of xylem supports its function in plants.', max:3, score:3, feedback:'Concise and scientifically accurate response.' },
  { id:9, text:'A plant bends toward sunlight. Name and explain this response.', max:2, score:1, feedback:'Phototropism is named correctly, but auxin redistribution is not explained.' },
  { id:10, text:'Why are food chains generally limited to four or five trophic levels?', max:3, score:2.5, feedback:'Correct energy-loss principle; quantify the transfer for full credit.' },
  { id:11, text:'State two functions of the ozone layer and one cause of its depletion.', max:3, score:3, feedback:'All requested points are present and correct.' },
  { id:12, text:'Differentiate biodegradable and non-biodegradable waste with examples.', max:4, score:4, feedback:'Complete comparison supported by suitable examples.' },
];

function VedaMark({ compact=false }: { compact?: boolean }) {
  return <div className={`veda-mark ${compact ? 'veda-mark--compact' : ''}`} aria-label="VedaAI"><span className="veda-symbol">V</span>{!compact && <span className="veda-wordmark">VedaAI</span>}</div>;
}

function Header({ screen, onBack }: { screen: Screen; onBack: () => void }) {
  return <header className="topbar"><div className="topbar-left"><button className="icon-button back-button" aria-label="Go back" onClick={onBack}>←</button><span className="page-crumb">{screen === 'results' ? 'Assessment review' : 'Exams'}</span></div><div className="mobile-brand"><VedaMark /></div><div className="topbar-actions"><button className="icon-button desktop-only" aria-label="Help">?</button><button className="icon-button notification" aria-label="Notifications">♢<span /></button><span className="spark-mini" aria-hidden="true">✦</span><button className="profile-button" aria-label="Open profile"><span className="avatar">MR</span><span className="profile-copy desktop-only"><strong>Madhur Khang</strong><small>Teacher</small></span><span className="desktop-only">⌄</span></button><button className="icon-button mobile-only" aria-label="Open menu">☰</button></div></header>;
}

function Sidebar({ compact }: { compact: boolean }) {
  return <aside className={`sidebar ${compact ? 'sidebar--compact' : ''}`}><VedaMark compact={compact}/><button className="toolkit-button" aria-label="AI Teacher's Toolkit"><span>✦</span><b>AI Teacher&apos;s Toolkit</b></button><nav aria-label="Primary navigation">{navItems.map(([icon,label])=><button key={label} className={label==='Exams'?'active':''} title={label}><span className="nav-icon">{icon}</span><b>{label}</b></button>)}</nav><div className="sidebar-footer"><button className="settings" title="Settings"><span>⚙</span><b>Settings</b></button><div className="school-card" title="Delhi Public School, Bokaro Steel City"><span className="school-seal">D</span><span className="school-copy"><strong>Delhi Public School</strong><small>Bokaro Steel City</small></span></div></div></aside>;
}

function UploadCard({ kind, file, onChoose, onRemove }: { kind: UploadKind; file: UploadedFile|null; onChoose:(kind:UploadKind,file?:File)=>void; onRemove:()=>void }) {
  const inputRef=useRef<HTMLInputElement>(null); const label=kind==='question'?'Question Paper':'Answer Sheet';
  const handleFile=(event:ChangeEvent<HTMLInputElement>)=>{const selected=event.target.files?.[0];if(selected)onChoose(kind,selected)};
  const handleDrop=(event:DragEvent<HTMLDivElement>)=>{event.preventDefault();const selected=event.dataTransfer.files?.[0];if(selected)onChoose(kind,selected)};
  return <div className={`upload-card ${file?'has-file':''}`} onDragOver={(e)=>e.preventDefault()} onDrop={handleDrop}><input ref={inputRef} type="file" accept="application/pdf,image/*" onChange={handleFile} hidden/>{file?<div className="file-pill"><span className="pdf-icon">PDF</span><span className="file-copy"><strong>{file.name}</strong><small>{file.size} · {file.pages} pages</small></span><button onClick={onRemove} aria-label={`Remove ${label}`}>×</button></div>:<><span className="upload-icon" aria-hidden="true">↥</span><button onClick={()=>inputRef.current?.click()}>Upload <em>{label}</em></button><small>PDF, PNG or JPG · up to 25 MB</small></>}</div>;
}

function UploadScreen({ questionFile, answerFile, chooseFile, removeFile, startMapping, loadDemo }: { questionFile:UploadedFile|null; answerFile:UploadedFile|null; chooseFile:(kind:UploadKind,file?:File)=>void; removeFile:(kind:UploadKind)=>void; startMapping:()=>void; loadDemo:()=>void }) {
  return <section className="upload-workspace" aria-labelledby="upload-title"><div className="title-block"><h1 id="upload-title">Upload <span>Question Paper &amp; Answer Sheets</span></h1><p>Upload both files to get started</p></div><div className="veda-orbit" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="orbit-dot dot-one">✦</span><span className="orbit-dot dot-two">✦</span><span className="teacher-core"><span>V</span></span></div><div className="upload-tray"><UploadCard kind="question" file={questionFile} onChoose={chooseFile} onRemove={()=>removeFile('question')}/><UploadCard kind="answer" file={answerFile} onChoose={chooseFile} onRemove={()=>removeFile('answer')}/></div><button className="mapping-button" disabled={!questionFile||!answerFile} onClick={startMapping}>Start Mapping <span>→</span></button><p className="upload-helper">Questions from the paper will be mapped to the student&apos;s handwritten answers. {!questionFile&&!answerFile&&<button onClick={loadDemo}>Try sample files</button>}</p></section>;
}

function ExtractingScreen({ progress }: { progress:number }) {
  const label=progress<30?'Reading both documents':progress<65?'Detecting question structure':progress<90?'Matching handwritten answers':'Preparing teacher review';
  return <section className="extracting-panel" aria-live="polite"><div className="extracting-content"><div className="extract-spark" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i><i>✦</i></div><h1>Extracting...</h1><p>This may take a while</p><div className="progress-track"><span style={{width:`${progress}%`}}/></div><small>{label}</small></div></section>;
}

function Score({ score, max }: { score:number; max:number }) { const ratio=score/max; const tone=ratio===1?'green':ratio>=.5?'amber':'red'; return <span className={`score score--${tone}`}>{score}/{max}</span>; }

function QuestionCard({ question, selected, expanded, onSelect, onViewAnswer }: { question:Question; selected:boolean; expanded:boolean; onSelect:()=>void; onViewAnswer:()=>void }) {
  return <article className={`question-card ${selected?'question-card--selected':''}`}><button className="question-summary" onClick={onSelect} aria-expanded={expanded}><span className="question-number">{question.id}</span><span className="question-text">{question.text}</span><Score score={question.score} max={question.max}/><span className="chevron">⌄</span></button>{expanded&&<div className="feedback"><span className="feedback-label">✦ AI Feedback</span><p>{question.feedback}</p><button className="view-answer" onClick={onViewAnswer}>View mapped answer <span>→</span></button></div>}</article>;
}

function QuestionsPanel({ selected, expandedAll, onExpandAll, onSelect, onViewAnswer }: { selected:number; expandedAll:boolean; onExpandAll:()=>void; onSelect:(id:number)=>void; onViewAnswer:(id:number)=>void }) {
  return <section className="questions-panel" aria-label="Extracted questions"><div className="panel-heading"><div><h1>Extracted Questions <span>(from question paper)</span></h1><p>12 questions · 34.5/40 marks detected</p></div><button onClick={onExpandAll}>{expandedAll?'Collapse All':'Expand All'}</button></div><div className="question-list">{questions.map(q=><QuestionCard key={q.id} question={q} selected={q.id===selected} expanded={expandedAll||q.id===selected} onSelect={()=>onSelect(q.id)} onViewAnswer={()=>onViewAnswer(q.id)}/>)}</div></section>;
}

const answerText:Record<number,string[]>={1:['Natural selection is the process in which organisms with useful variations survive and reproduce.','Over generations, favourable traits become common and this causes evolution.'],2:['This organism is commonly mistaken for a plant.','It is actually a sea anemone, an animal attached to rocks.'],3:['Chloroplasts contain chlorophyll that absorbs sunlight.','Light energy is converted into chemical energy during photosynthesis.'],4:['Blood enters the right atrium, travels to the right ventricle and then to the lungs.','Oxygenated blood returns to the left side and is pumped to the body.'],5:['Animal cell: cell membrane, nucleus, cytoplasm and mitochondria are labelled.'],6:['Asexual reproduction uses one parent while sexual reproduction involves two parents.'],7:['A reflex is a rapid automatic response through a reflex arc in the spinal cord.'],8:['Xylem vessels are hollow and lignified, forming continuous tubes for water transport.'],9:['The response is phototropism. The shoot grows towards the light.'],10:['Energy is lost at each trophic level, leaving too little energy at higher levels.'],11:['Ozone absorbs harmful UV radiation. CFCs cause ozone depletion.'],12:['Biodegradable waste decomposes naturally; non-biodegradable waste persists.']};

function AnswerSheet({ selected, page, zoom, onPage, onZoom }: { selected:number; page:number; zoom:number; onPage:(page:number)=>void; onZoom:(zoom:number)=>void }) {
  const start=(page-1)*3+1; const pageQuestions=questions.slice(start-1,start+2);
  return <section className="answer-panel" aria-label="Answer sheet"><div className="answer-toolbar"><strong>Answer Sheet</strong><div className="viewer-actions"><div className="zoom-control"><button onClick={()=>onZoom(Math.max(75,zoom-25))} aria-label="Zoom out">−</button><span>{zoom}%</span><button onClick={()=>onZoom(Math.min(150,zoom+25))} aria-label="Zoom in">+</button></div><div className="page-control"><button onClick={()=>onPage(Math.max(1,page-1))} disabled={page===1}>‹</button><span>Page {page} of 4</span><button onClick={()=>onPage(Math.min(4,page+1))} disabled={page===4}>›</button></div></div></div><div className="paper-viewport"><div className="paper" style={{transform:`scale(${zoom/100})`}}><div className="paper-top"><span>SCIENCE · CLASS X</span><span>Roll No. 18</span></div><h2>Answer Sheet</h2><div className="student-line"><span>Name: Madhur K.</span><span>Date: 14.08.2026</span></div>{pageQuestions.map(q=><div key={q.id} className={`written-answer ${q.id===selected?'written-answer--selected':''}`}><span className="mapped-tag">Q{q.id}</span><strong>Q{q.id}.</strong>{answerText[q.id].map((line,index)=><p key={index}>{line}</p>)}{q.id===2&&<div className="sketch" aria-label="Student sketch"><span>✣</span><i/><i/><i/></div>}</div>)}<div className="page-number">{page}</div></div></div></section>;
}

function ResultsScreen({ selected, onSelected }: { selected:number; onSelected:(id:number)=>void }) {
  const [tab,setTab]=useState<MobileTab>('questions'); const [expandedAll,setExpandedAll]=useState(false); const [zoom,setZoom]=useState(100); const [page,setPage]=useState(1);
  const selectQuestion=(id:number)=>{onSelected(id);setPage(Math.ceil(id/3))};
  return <div className="results-workspace"><div className="mobile-tabs" role="tablist"><button className={tab==='questions'?'active':''} onClick={()=>setTab('questions')}>Questions</button><button className={tab==='answer'?'active':''} onClick={()=>setTab('answer')}>Answer Sheet</button></div><div className={`result-column result-column--questions ${tab==='questions'?'mobile-active':''}`}><QuestionsPanel selected={selected} expandedAll={expandedAll} onExpandAll={()=>setExpandedAll(!expandedAll)} onSelect={selectQuestion} onViewAnswer={(id)=>{selectQuestion(id);setTab('answer')}}/></div><div className={`result-column result-column--answer ${tab==='answer'?'mobile-active':''}`}><AnswerSheet selected={selected} page={page} zoom={zoom} onPage={setPage} onZoom={setZoom}/></div><button className="mobile-view-fab" onClick={()=>setTab(tab==='questions'?'answer':'questions')}>{tab==='questions'?'View highlighted answer →':'← Back to questions'}</button></div>;
}

function Intro(){return <div className="brand-intro" aria-hidden="true"><div className="intro-mark"><span>V</span><i>✦</i><i>✦</i><i>✦</i></div><strong>VedaAI</strong><small>AI that understands your classroom</small></div>}

export default function Home(){
  const [screen,setScreen]=useState<Screen>('upload'); const [questionFile,setQuestionFile]=useState<UploadedFile|null>(null); const [answerFile,setAnswerFile]=useState<UploadedFile|null>(null); const [progress,setProgress]=useState(0); const [selected,setSelected]=useState(2); const [showIntro,setShowIntro]=useState(true);
  useEffect(()=>{const timer=window.setTimeout(()=>setShowIntro(false),1250);return()=>window.clearTimeout(timer)},[]);
  useEffect(()=>{if(screen!=='extracting')return;setProgress(8);const ticks:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[[450,28],[1050,51],[1700,74],[2300,91],[2850,100]];const timers=ticks.map(([delay,value])=>window.setTimeout(()=>setProgress(value),delay));timers.push(window.setTimeout(()=>setScreen('results'),3300));return()=>timers.forEach(timer=>window.clearTimeout(timer))},[screen]);
  const chooseFile=(kind:UploadKind,file?:File)=>{const next={name:file?.name||(kind==='question'?'Class_10_Science.pdf':'Madhur_Answer_Sheet.pdf'),size:file?`${Math.max(file.size/1024/1024,.1).toFixed(1)} MB`:'2.4 MB',pages:kind==='question'?3:4};if(kind==='question')setQuestionFile(next);else setAnswerFile(next)};
  const loadDemo=()=>{chooseFile('question');chooseFile('answer')}; const goBack=()=>{if(screen==='upload')return;setScreen('upload');setProgress(0)};
  return <>{showIntro&&<Intro/>}<main className={`app-shell app-shell--${screen}`}><Sidebar compact={screen!=='upload'}/><div className="app-main"><Header screen={screen} onBack={goBack}/>{screen==='upload'&&<UploadScreen questionFile={questionFile} answerFile={answerFile} chooseFile={chooseFile} removeFile={(kind)=>kind==='question'?setQuestionFile(null):setAnswerFile(null)} startMapping={()=>setScreen('extracting')} loadDemo={loadDemo}/>} {screen==='extracting'&&<ExtractingScreen progress={progress}/>} {screen==='results'&&<ResultsScreen selected={selected} onSelected={setSelected}/>}</div></main></>;
}
