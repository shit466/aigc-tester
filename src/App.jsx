import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardCopy,
  Download,
  FileScan,
  FileText,
  Languages,
  PenLine,
  Radar,
  RotateCcw,
  Route,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Waves
} from "lucide-react";

const sample = `随着生成式人工智能技术在高等教育中的广泛应用，论文写作过程中的文本生成、资料整理和语言润色方式发生了明显变化。本文认为，AIGC 工具能够在一定程度上提高文献检索和初稿组织效率，但如果学生过度依赖自动生成内容，论文将呈现出论证路径趋同、概念解释空泛以及经验材料不足等问题。

In English academic writing, AI detection tools such as GPTZero are useful for an initial signal, but the result should not be treated as a final judgment. A reliable workflow should combine detector output, citation review, paragraph-level inspection, and the author's own research notes.

从论文质量评价的角度看，单纯降低所谓 AI 率并不能真正提升学术可信度。作者需要解释研究对象的选择理由、数据来源、分析限制和与既有文献的关系。若段落中连续出现“综上所述”“进一步而言”“具有重要意义”等模板化表达，而缺乏具体案例与文献支撑，则容易被判定为高风险文本。

因此，本研究建议建立一种面向写作过程的诊断机制：首先识别文本中的疑似生成式表达，其次指出该表达为何影响论文质量，最后要求作者补充真实阅读、实验记录或访谈材料。`;

const riskZh = ["综上所述", "进一步而言", "重要意义", "显著提升", "广泛应用", "一定程度", "本文认为", "因此", "机制", "路径"];
const riskEn = ["in conclusion", "it is important", "significant", "reliable workflow", "initial signal"];
const voice = ["我", "本文", "本研究", "实验", "访谈", "数据", "样本", "案例", "记录", "notes", "data", "interview", "experiment", "sample"];

const countChars = text => text.replace(/\s/g, "").length;

function languageOf(text) {
  const zh = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (text.match(/[A-Za-z]/g) || []).length;
  if (zh > en * 0.55) return "中文";
  if (en > zh * 1.8) return "EN";
  return "混合";
}

function citationCount(text) {
  return (text.match(/\[[0-9,\-\s]+\]|（[^）]*(19|20)\d{2}[^）]*）|\([^)]*(19|20)\d{2}[^)]*\)/g) || []).length;
}

function scoreParagraph(text, strictness, citationWeight) {
  const lower = text.toLowerCase();
  const sentences = text.split(/[。！？.!?]+/).map(item => item.trim()).filter(Boolean);
  const lengths = sentences.map(countChars);
  const average = lengths.reduce((sum, item) => sum + item, 0) / Math.max(1, lengths.length);
  const variance = lengths.reduce((sum, item) => sum + Math.pow(item - average, 2), 0) / Math.max(1, lengths.length);
  const words = riskZh.filter(word => text.includes(word)).length + riskEn.filter(word => lower.includes(word)).length;
  const voices = voice.filter(word => lower.includes(word.toLowerCase())).length;
  const cites = citationCount(text);
  const flatness = variance < 180 && sentences.length > 2 ? 18 : variance < 420 ? 9 : 0;
  const citePenalty = cites === 0 ? 18 * citationWeight : cites === 1 ? 7 * citationWeight : -4;
  const base = 38 + (words / Math.max(1, sentences.length)) * 30 + flatness + citePenalty - Math.min(18, voices * 4);
  const risk = Math.max(6, Math.min(96, Math.round(base * (0.72 + strictness * 0.55))));
  return { lang: languageOf(text), risk, cites, voices, words, sentenceCount: sentences.length };
}

function adviceFor(item) {
  if (item.risk >= 72 && item.cites === 0) return "优先补证据：加入具体文献、数据来源或案例，并说明它如何支持本段判断。";
  if (item.risk >= 72 && item.words > 1) return "减少模板化连接词，改成问题、材料、推理、结论的顺序。";
  if (item.risk >= 58 && item.voices < 2) return "补作者声音：写清楚你的样本、实验、访谈、阅读记录或选择理由。";
  if (item.risk >= 45) return "建议人工复核：增加一个具体例子或限制说明。";
  return "低风险段落：保持现有表达，检查引用格式和上下文衔接即可。";
}

function heat(risk) {
  if (risk >= 72) return { color: "#e95f46", label: "高风险", bg: "rgba(233, 95, 70, .16)" };
  if (risk >= 55) return { color: "#e9b949", label: "需复核", bg: "rgba(233, 185, 73, .18)" };
  return { color: "#53a548", label: "低风险", bg: "rgba(83, 165, 72, .14)" };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

async function extractPaperText(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["txt", "md", "markdown"].includes(extension)) return file.text();
  if (extension === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    return (await mammoth.default.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  }
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str).join(" "));
    }
    return pages.join("\n\n");
  }
  throw new Error("unsupported-file");
}

function Constellation({ pulse }) {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let width = 0;
    let height = 0;
    let frame = 0;
    let particles = [];
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      height = canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      particles = Array.from({ length: width < 900 ? 36 : 64 }, (_, index) => ({
        x: (index * 137.5) % width,
        y: (index * 71.7) % height,
        vx: ((index % 5) - 2) * 0.12,
        vy: ((index % 7) - 3) * 0.08,
        hue: index % 3
      }));
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        if (!reduced) {
          particle.x = (particle.x + particle.vx + width) % width;
          particle.y = (particle.y + particle.vy + height) % height;
        }
        const color = particle.hue === 0 ? "#0e8f88" : particle.hue === 1 ? "#355caa" : "#e95f46";
        context.globalAlpha = reduced ? 0.28 : 0.68;
        context.fillStyle = color;
        context.beginPath();
        context.arc(particle.x, particle.y, pulse ? 3 : 1.8, 0, Math.PI * 2);
        context.fill();
        particles.slice(index + 1).forEach(other => {
          const distance = Math.hypot(other.x - particle.x, other.y - particle.y);
          if (distance < 130) {
            context.globalAlpha = (1 - distance / 130) * 0.12;
            context.strokeStyle = color;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);
            context.stroke();
          }
        });
      });
      frame = requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [pulse, reduced]);
  return <canvas className="constellation" ref={canvasRef} aria-hidden="true" />;
}

function Header({ onSample, onReset, onCopy }) {
  return (
    <header className="topbar">
      <div className="brand"><div className="brandMark"><FileText size={18} /></div><span>PaperTrace</span></div>
      <nav className="topActions" aria-label="工具">
        <button className="iconButton" onClick={onSample} title="载入样稿"><Download size={18} /></button>
        <button className="iconButton" onClick={onReset} title="重置"><RotateCcw size={18} /></button>
        <button className="iconButton" onClick={onCopy} title="复制报告"><ClipboardCopy size={18} /></button>
      </nav>
    </header>
  );
}

function ModeSwitch({ mode, setMode }) {
  return (
    <div className="segmented" role="tablist">
      {[["mixed", "混合", Languages], ["zh", "中文", BookOpenCheck], ["en", "English", Radar]].map(([value, label, Icon]) => (
        <button key={value} className={mode === value ? "active" : ""} onClick={() => setMode(value)} role="tab">
          <Icon size={15} /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function FlowRail({ mode }) {
  return (
    <section className="flowRail">
      <div className="routeNode input"><FileScan size={18} /><span>论文切片</span></div>
      <div className="flowTrack"><span className="flowPacket packetA" /><span className="flowPacket packetB" /><span className="flowPacket packetC" /></div>
      <div className={`routeNode detector ${mode === "en" ? "lit" : ""}`}><Radar size={18} /><span>GPTZero</span></div>
      <div className={`routeNode detector ${mode === "zh" ? "lit" : ""}`}><ShieldCheck size={18} /><span>中文报告</span></div>
      <div className="routeNode output"><PenLine size={18} /><span>修改建议</span></div>
    </section>
  );
}

function DifferencePanel() {
  const rows = [
    [Route, "检测器路由，不是单一检测器", "英文可接 GPTZero、Copyleaks 等；中文优先解析知网、维普、万方报告。"],
    [BarChart3, "从判定变成可修改问题", "把风险拆成模板化、证据不足、句式单调、引用缺失、论证跳跃。"],
    [PenLine, "保留作者声音", "只给改法和补强方向，不一键重写整篇。"]
  ];
  return (
    <aside className="differencePanel">
      <div className="kicker">和 GPTZero 的区别</div>
      <h1>检测结果会动，修改思路也要动。</h1>
      <p>PaperTrace 把检测信号变成论文写作决策：哪里该补文献，哪里该补样本，哪里只是检测器可能误判。</p>
      <div className="diffRows">{rows.map(([Icon, title, text]) => <div className="diffRow" key={title}><Icon size={24} /><div><strong>{title}</strong><span>{text}</span></div></div>)}</div>
    </aside>
  );
}

function Workbench({ text, setText, strictness, setStrictness, citationWeight, setCitationWeight, report, mode, scanVersion }) {
  const listRef = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !listRef.current) return undefined;
    const context = gsap.context(() => {
      gsap.fromTo(".paragraphCard", { autoAlpha: 0, y: 28, rotationX: -8 }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.58, stagger: 0.08, ease: "power3.out" });
    }, listRef);
    return () => context.revert();
  }, [scanVersion, reduced]);
  return (
    <div className="workbench">
      <section className="pane manuscriptPane">
        <div className="paneHead"><h2><PenLine size={18} />论文片段</h2><span className="livePill"><span />{countChars(text)} 字</span></div>
        <textarea value={text} onChange={event => setText(event.target.value)} spellCheck={false} />
        <div className="sliders">
          <label><span>严格度</span><input type="range" min="0" max="100" value={Math.round(strictness * 100)} onChange={event => setStrictness(Number(event.target.value) / 100)} /><b>{Math.round(strictness * 100)}</b></label>
          <label><span>引用权重</span><input type="range" min="0" max="100" value={Math.round(citationWeight * 100)} onChange={event => setCitationWeight(Number(event.target.value) / 100)} /><b>{Math.round(citationWeight * 100)}</b></label>
        </div>
      </section>
      <section className="pane reportPane">
        <div className="paneHead"><h2><BarChart3 size={18} />段落热力</h2><span className="livePill"><span />{mode === "mixed" ? "混合路由" : mode === "zh" ? "中文报告路由" : "English API"}</span></div>
        <div className="metricDeck">
          <article><span>综合风险</span><b>{report.summary.average}%</b><small>段落均值</small></article>
          <article><span>高风险段</span><b>{report.summary.high}</b><small>优先修改</small></article>
          <article><span>引用缺口</span><b>{report.summary.citeGap}</b><small>需补证据</small></article>
          <article><span>作者声音</span><b>{report.summary.voice}%</b><small>越高越好</small></article>
        </div>
        <div className="reportList" ref={listRef}>
          {report.items.map(item => {
            const itemHeat = heat(item.risk);
            return (
              <article className="paragraphCard" key={`${scanVersion}-${item.index}`} style={{ "--heat": itemHeat.color, "--heat-bg": itemHeat.bg }}>
                <div className="cardTop"><span className="heatDot" /><strong>P{item.index + 1} · {item.lang} · {itemHeat.label}</strong><b>{item.risk}%</b></div>
                <p>{item.text}</p>
                <div className="advice"><Sparkles size={16} /><span>{adviceFor(item)}</span></div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ProcessStrip() {
  return (
    <section className="processStrip">
      {[[FileScan, "拆段", "按论文结构和语种切片。"], [Languages, "分流", "英文接检测 API，中文解析机构报告。"], [ScanLine, "解释", "把百分比拆成可修改原因。"], [Waves, "改进", "给修改方向，不代写最终稿。"]].map(([Icon, title, text]) => (
        <article key={title}><Icon size={24} /><b>{title}</b><span>{text}</span></article>
      ))}
    </section>
  );
}

export default function App() {
  const [text, setText] = useState(sample);
  const [mode, setMode] = useState("mixed");
  const [strictness, setStrictness] = useState(0.62);
  const [citationWeight, setCitationWeight] = useState(0.54);
  const [scanVersion, setScanVersion] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState("");
  const fileInputRef = useRef(null);
  const reduced = useReducedMotion();

  const report = useMemo(() => {
    const paragraphs = text.trim().split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
    const items = paragraphs.map((paragraph, index) => ({ text: paragraph, index, ...scoreParagraph(paragraph, strictness, citationWeight) }));
    const average = items.length ? Math.round(items.reduce((sum, item) => sum + item.risk, 0) / items.length) : 0;
    return {
      items,
      summary: {
        average,
        high: items.filter(item => item.risk >= 72).length,
        citeGap: items.filter(item => item.cites === 0 && item.risk >= 45).length,
        voice: items.length ? Math.max(12, Math.min(96, Math.round(100 - average + items.reduce((sum, item) => sum + item.voices, 0) * 3))) : 0
      }
    };
  }, [text, strictness, citationWeight]);

  useEffect(() => {
    if (reduced) return undefined;
    const context = gsap.context(() => {
      gsap.from(".topbar", { y: -24, autoAlpha: 0, duration: 0.55, ease: "power3.out" });
      gsap.from(".differencePanel > *", { y: 26, autoAlpha: 0, stagger: 0.08, duration: 0.62, ease: "power3.out" });
      gsap.to(".routeNode", { scale: 1.04, duration: 0.8, repeat: -1, yoyo: true, stagger: 0.16, ease: "power1.inOut" });
      gsap.to(".flowPacket", { x: "random(-16, 16)", y: "random(-12, 12)", duration: 1.1, repeat: -1, yoyo: true, stagger: 0.18, ease: "sine.inOut" });
    });
    return () => context.revert();
  }, [reduced]);

  const showToast = message => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2300);
  };
  const scan = () => {
    setScanning(true);
    setScanVersion(version => version + 1);
    showToast("诊断完成：风险来自写作特征，不等同于 AI 判定。");
    window.setTimeout(() => setScanning(false), 1100);
  };
  const importPaper = async file => {
    if (!file) return;
    try {
      showToast(`正在解析：${file.name}`);
      const normalized = (await extractPaperText(file)).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!normalized) return showToast("没有提取到可检测文本。扫描版 PDF 需要先做 OCR。");
      setText(normalized);
      scan();
    } catch (error) {
      showToast(error.message === "unsupported-file" ? "暂支持 .txt、.md、.docx、.pdf。" : "文件解析失败，请换成可复制文本的文档。");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const copyReport = () => {
    const body = report.items.map(item => `P${item.index + 1} ${item.lang} ${item.risk}%：${adviceFor(item)}`).join("\n") || "暂无报告";
    navigator.clipboard?.writeText(body).then(() => showToast("报告已复制。")).catch(() => showToast("当前浏览器限制了复制权限。"));
  };

  return (
    <div className="app">
      <Constellation pulse={scanning} />
      <Header onSample={() => { setText(sample); showToast("已载入中英文混合样稿。"); }} onReset={() => { setText(""); showToast("文本已清空。"); }} onCopy={copyReport} />
      <main>
        <section className="heroGrid">
          <DifferencePanel />
          <section className={`labShell ${scanning ? "scanning" : ""}`}>
            <input ref={fileInputRef} className="fileInput" type="file" accept=".txt,.md,.markdown,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => importPaper(event.target.files?.[0])} />
            <div className="labToolbar">
              <ModeSwitch mode={mode} setMode={setMode} />
              <div className="labActions"><button className="ghostButton" onClick={() => fileInputRef.current?.click()}><FileScan size={17} />上传论文</button><button className="primaryButton" onClick={scan}><ScanLine size={18} />运行诊断</button></div>
            </div>
            <FlowRail mode={mode} />
            <Workbench text={text} setText={setText} strictness={strictness} setStrictness={setStrictness} citationWeight={citationWeight} setCitationWeight={setCitationWeight} report={report} mode={mode} scanVersion={scanVersion} />
          </section>
        </section>
        <ProcessStrip />
        <section className="downloadBand"><div><strong>稳定交付路线</strong><span>开发用 Vite，发布用静态构建。后续可直接接 GitHub Pages 或桌面壳。</span></div><ArrowRight size={22} /></section>
      </main>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
