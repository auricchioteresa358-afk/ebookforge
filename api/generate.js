export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt, format, length, lang, imageStyle } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const lengthConfig = {
    concise: { words: "800-1200 parole", chapters: "3-4 capitoli", tokens: 2000 },
    standard: { words: "1500-2500 parole", chapters: "5-7 capitoli", tokens: 3500 },
    comprehensive: { words: "2500-4000 parole", chapters: "8-10 capitoli", tokens: 5000 },
  };
  const cfg = lengthConfig[length] || lengthConfig.standard;

  const formatConfig = {
    ebook: { label: "Ebook", style: "ebook professionale con copertina, indice, capitoli numerati, esempi pratici e box suggerimenti" },
    guide: { label: "Guida Pratica", style: "guida pratica step-by-step con sezioni numerate, istruzioni chiare, esempi reali e checklist" },
    report: { label: "Report", style: "report professionale con executive summary, analisi per sezioni, insight chiave e raccomandazioni" },
    checklist: { label: "Checklist", style: "checklist operativa con categorie principali, sotto-voci dettagliate e note pratiche" },
  };
  const fmt = formatConfig[format] || formatConfig.ebook;
  const langLabel = lang === "it" ? "italiano" : "inglese";

  const imageInstructions =
    imageStyle === "none" ? ""
    : imageStyle === "icons" ? `Dopo ogni capitolo aggiungi: <div class="img-placeholder icons"><span class="img-icon">[emoji rilevante]</span><span class="img-label">[Concetto chiave]</span></div>`
    : imageStyle === "charts" ? `Dove rilevante aggiungi: <div class="img-placeholder chart"><div class="chart-bars"><span style="height:60%"></span><span style="height:85%"></span><span style="height:45%"></span><span style="height:95%"></span><span style="height:70%"></span></div><span class="img-label">[Descrizione dato]</span></div>`
    : `Dopo ogni 2 capitoli aggiungi: <div class="img-placeholder visual"><span class="img-icon">🖼️</span><span class="img-label">[Descrizione immagine contestuale]</span></div>`;

  const systemPrompt = `Sei un ghostwriter esperto. Crei ${fmt.style} in ${langLabel}.

STRUTTURA HTML (usa esattamente questi tag):

<div class="doc-cover">
  <div class="cover-badge">[FORMATO]</div>
  <h1 class="cover-title">[TITOLO]</h1>
  <p class="cover-subtitle">[Sottotitolo]</p>
  <div class="cover-stats">
    <div class="stat"><span class="stat-num">[N]</span><span class="stat-label">Capitoli</span></div>
    <div class="stat"><span class="stat-num">[N] min</span><span class="stat-label">Di lettura</span></div>
    <div class="stat"><span class="stat-num">2026</span><span class="stat-label">Edizione</span></div>
  </div>
</div>

<div class="toc-block">
  <div class="toc-header">✦ INDICE DEI CONTENUTI</div>
  <div class="toc-list">
    <div class="toc-item"><span class="toc-num">01</span><span class="toc-title-text">[Titolo]</span><span class="toc-page">p.1</span></div>
  </div>
</div>

Per ogni capitolo:
<div class="chapter">
  <div class="chapter-header">
    <div class="chapter-label">CAPITOLO [N]</div>
    <h2 class="chapter-title">[Titolo]</h2>
    <p class="chapter-intro">[Intro]</p>
  </div>
  <div class="chapter-body">[contenuto con paragrafi, h3, liste]</div>
</div>

Per suggerimenti: <div class="tip-box"><span class="tip-icon">💡</span><div class="tip-content"><strong>Consiglio Pro:</strong> [testo]</div></div>
Per azioni: <div class="action-box"><span class="action-icon">🎯</span><div class="action-content"><strong>Azione Immediata:</strong> [testo]</div></div>

${imageInstructions}

Chiudi con:
<div class="doc-conclusion"><h2>Conclusione & Prossimi Passi</h2>[2-3 paragrafi + 5 step concreti]</div>

IMPORTANTE: Rispondi SOLO con HTML. Zero testo fuori dai tag. Zero markdown.`;

  const userMessage = `Crea: "${prompt}" — Formato: ${fmt.label} — Lunghezza: ${cfg.words} (${cfg.chapters}) — Lingua: ${langLabel}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: cfg.tokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const html = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ html, usage: data.usage });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
