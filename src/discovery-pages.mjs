const SITE = "https://mcpqueen.com";
const REPOSITORY = "https://github.com/mcpqueen/mcpqueen";
const EXAMPLES = `${REPOSITORY}/tree/main/examples`;

export const DISCOVERY_PAGES = Object.freeze({
  "/architecture": {
    title: "MCP Queen architecture and trust boundaries",
    description:
      "How MCP Queen discovers MCP servers, records operational evidence, separates Trust Receipts, and keeps the final connection decision outside its boundary.",
  },
  "/integrations": {
    title: "MCP integrations for agents and developers",
    description:
      "Connect MCP Queen to OpenAI, Claude, LangChain, LlamaIndex, Cloudflare Agents, and Hugging Face with runnable Streamable HTTP examples.",
  },
  "/demo": {
    title: "MCP Queen discovery and evidence demo",
    description:
      "Prepared chapter, transcript, and caption structure for a genuine MCP Queen discovery and evidence walkthrough; footage is not yet published.",
  },
  "/mcp-info": {
    title: "MCP tools for server discovery and evidence",
    description:
      "Use MCP Queen tools to find MCP servers, search observed tool catalogs, inspect operational grades, and review available evidence before connecting.",
  },
});

export const STATIC_SITEMAP_PATHS = Object.freeze([
  "/",
  "/registry",
  "/compare",
  "/mcp-info",
  "/architecture",
  "/integrations",
  "/demo",
  "/field-reports",
  "/mcp-security-evidence",
  "/reports",
  "/privacy",
  "/terms",
]);

const breadcrumbs = (path, name) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "MCP Queen", item: SITE },
    { "@type": "ListItem", position: 2, name, item: `${SITE}${path}` },
  ],
});

export function discoverySchema(path) {
  if (path === "/mcp-info") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebPage",
          "@id": `${SITE}/mcp-info#webpage`,
          url: `${SITE}/mcp-info`,
          name: DISCOVERY_PAGES["/mcp-info"].title,
          description: DISCOVERY_PAGES["/mcp-info"].description,
          about: { "@id": `${SITE}/#software` },
          mainEntity: {
            "@type": "ItemList",
            name: "MCP Queen tools",
            numberOfItems: 7,
            itemListElement: [
              "search_servers",
              "search_tools",
              "list_grades",
              "get_server_grade",
              "get_trust_receipt",
              "search_trust_evidence",
              "submit_feedback",
            ].map((name, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name,
            })),
          },
        },
        breadcrumbs("/mcp-info", "MCP tool reference"),
      ],
    };
  }
  return getDiscoveryPage(path)?.jsonld ?? null;
}

const architecture = {
  ...DISCOVERY_PAGES["/architecture"],
  jsonld: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": `${SITE}/architecture#article`,
        headline: "MCP Queen architecture and trust boundaries",
        name: "MCP Queen architecture and trust boundaries",
        description: DISCOVERY_PAGES["/architecture"].description,
        url: `${SITE}/architecture`,
        mainEntityOfPage: `${SITE}/architecture`,
        dateModified: "2026-07-29",
        author: { "@type": "Organization", name: "MCP Queen", url: SITE },
        about: [
          "Model Context Protocol server discovery",
          "Operational evidence",
          "Trust boundaries",
        ],
      },
      breadcrumbs("/architecture", "Architecture"),
    ],
  },
  body: `
<h2>Architecture and trust boundaries</h2>
<p class="muted">MCP Queen is an evidence and discovery layer between the public MCP ecosystem and a developer's connection decision. It observes public surfaces and publishes dated evidence. It does not certify security, authorize a server, proxy the selected connection, or inspect private data behind credentials.</p>

<h3>System at a glance</h3>
<div class="card" aria-label="MCP Queen architecture flow">
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:stretch">
    <section class="card" style="margin:0"><p><strong>1. Public inputs</strong></p><p class="muted">Official MCP Registry metadata, public remote endpoints, public repositories, authoritative evidence sources, and reviewed field reports.</p></section>
    <section class="card" style="margin:0"><p><strong>2. Observation pipeline</strong></p><p class="muted">Registry sync, bounded protocol probes, deterministic grading, safe read-only response audits, and human moderation.</p></section>
    <section class="card" style="margin:0"><p><strong>3. Evidence store</strong></p><p class="muted">Server metadata, observed tools, probe history, grades, separate trust observations, response benchmarks, and quarantined feedback.</p></section>
    <section class="card" style="margin:0"><p><strong>4. Read surfaces</strong></p><p class="muted">MCP tools, evidence pages, Trust Receipts, JSON APIs, reports, datasets, and operational-grade badges.</p></section>
  </div>
  <p class="faint" style="margin-bottom:0">Public inputs → bounded observations → dated evidence → human or agent review → a separate direct connection to the selected server.</p>
</div>

<h3>The boundaries that matter</h3>
<table class="evtable">
<thead><tr><th>Boundary</th><th>Inside MCP Queen</th><th>Outside MCP Queen</th></tr></thead>
<tbody>
<tr><td>Discovery</td><td class="muted">Indexes public registry metadata and tool catalogs observed through <code>tools/list</code>.</td><td class="muted">Does not endorse, install, or authorize a discovered server.</td></tr>
<tr><td>Operational probes</td><td class="muted">Uses bounded public <code>initialize</code> and capability-discovery requests, records latency and verbatim observations, and marks auth-gated dimensions provisional.</td><td class="muted">Does not bypass authentication or infer private tool behavior.</td></tr>
<tr><td>Operational grade</td><td class="muted">Summarizes observed reachability, protocol behavior, tool metadata, latency, and provenance using a deterministic rubric.</td><td class="muted">Is not a security, privacy, compliance, or data-quality certification.</td></tr>
<tr><td>Trust Receipt</td><td class="muted">Keeps dated security/access, data-integrity, citation, claim, response-benchmark, and reviewed field evidence separate.</td><td class="muted">Missing evidence remains unaudited; it is never converted into a pass.</td></tr>
<tr><td>Connection</td><td class="muted">Returns a server's published endpoint and available evidence.</td><td class="muted">The developer or agent decides whether to connect and then connects directly. MCP Queen is not a proxy in that data path.</td></tr>
<tr><td>Feedback</td><td class="muted"><code>submit_feedback</code> accepts factual reports only after real use and places them in a quarantined review queue.</td><td class="muted">Reports do not auto-publish, count as votes, or directly change operational grades.</td></tr>
</tbody>
</table>

<h3>Runtime components</h3>
<div class="card">
<ul>
<li><strong>Cloudflare Worker:</strong> public HTML, JSON APIs, the remote MCP endpoint, scheduled registry sync, and bounded probes.</li>
<li><strong>D1 evidence store:</strong> public registry observations, probe history, separate evidence dimensions, benchmarks, and quarantined feedback.</li>
<li><strong>Static assets:</strong> the landing page, icons, datasets, captions, and other public files.</li>
<li><strong>Key-gated operator routes:</strong> maintenance controls that are not MCP tools and are not part of the public discovery surface.</li>
</ul>
</div>

<h3>Developer decision flow</h3>
<ol>
<li><a href="/registry">Find a server</a> by task or search the observed tool catalog through MCP.</li>
<li>Inspect the server's dated operational observations and whether any dimensions are provisional.</li>
<li>Review the separate Trust Receipt and label missing dimensions unaudited.</li>
<li>Evaluate the selected server's own permissions, terms, credentials, and data handling.</li>
<li>Connect directly only after that separate decision.</li>
</ol>
<p class="muted">Continue with the <a href="/integrations">integration guides</a>, the <a href="/mcp-info">tool reference</a>, or the detailed <a href="/registry#methodology">operational methodology</a>. Repository implementation notes are in <a href="${REPOSITORY}/blob/main/docs/architecture.md">docs/architecture.md</a>.</p>`,
};

const integrationFaqs = [
  {
    question: "Does MCP Queen require an API key?",
    answer:
      "No. The MCP Queen endpoint is public, uses Streamable HTTP, and requires no authentication. An agent framework may still require credentials for its own model provider.",
  },
  {
    question: "Can an agent connect directly to a server it finds?",
    answer:
      "Yes. MCP Queen returns the server's published endpoint and available evidence. Connection and authorization happen separately and directly with the selected server.",
  },
  {
    question: "Does an A operational grade prove that an MCP server is secure?",
    answer:
      "No. Operational grades measure observed protocol behavior, tool metadata, latency, and provenance. Security, data integrity, citations, claims, response benchmarks, and reviewed field use remain separate evidence dimensions; missing evidence is unaudited.",
  },
];

const integrations = {
  ...DISCOVERY_PAGES["/integrations"],
  jsonld: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE}/integrations#webpage`,
        url: `${SITE}/integrations`,
        name: "MCP Queen integrations for AI agents and developer frameworks",
        description: DISCOVERY_PAGES["/integrations"].description,
        about: { "@id": `${SITE}/#software` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE}/#software`,
        name: "MCP Queen",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        url: SITE,
        codeRepository: REPOSITORY,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        featureList: [
          "Search MCP servers and observed tools by capability",
          "Compare deterministic live operational grades",
          "Inspect dated Trust Receipts and evidence caveats",
          "Connect over public no-auth Streamable HTTP",
        ],
      },
      {
        "@type": "ItemList",
        name: "MCP Queen integration guides",
        numberOfItems: 6,
        itemListElement: [
          ["OpenAI", "#openai"],
          ["Claude", "#claude"],
          ["LangChain", "#langchain"],
          ["LlamaIndex", "#llamaindex"],
          ["Cloudflare Agents", "#cloudflare"],
          ["Hugging Face", "#huggingface"],
        ].map(([name, anchor], index) => ({
          "@type": "ListItem",
          position: index + 1,
          name,
          url: `${SITE}/integrations${anchor}`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: integrationFaqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      breadcrumbs("/integrations", "Integrations"),
    ],
  },
  body: `
<h2>Connect MCP Queen to your agent stack</h2>
<p class="muted">One public endpoint gives an agent MCP server discovery and available operational evidence before a separate connection decision.</p>
<div class="card">
<p><strong>Universal endpoint</strong></p>
<pre>https://mcpqueen.com/mcp</pre>
<p class="muted">Transport: Streamable HTTP · Authentication: none · Six read-only discovery/evidence tools plus one quarantined feedback tool.</p>
<p class="faint">Trust boundary: MCP Queen returns published endpoints and observations. It does not proxy or authorize the server you choose. <a href="/architecture">See the architecture and trust boundaries →</a></p>
</div>

<h3>Choose your client</h3>
<p><a class="pill" href="#openai">OpenAI</a><a class="pill" href="#claude">Claude</a><a class="pill" href="#langchain">LangChain</a><a class="pill" href="#llamaindex">LlamaIndex</a><a class="pill" href="#cloudflare">Cloudflare Agents</a><a class="pill" href="#huggingface">Hugging Face</a></p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px">
<section class="card" id="openai"><h3>OpenAI</h3>
<p class="muted">Use the hosted MCP endpoint in a compatible OpenAI client or as an MCP tool in the Responses API. The example allowlists only the six read-only discovery and evidence tools.</p>
<pre>{
  "type": "mcp",
  "server_label": "mcpqueen",
  "server_url": "https://mcpqueen.com/mcp",
  "allowed_tools": ["search_servers", "search_tools"]
}</pre>
<p><a href="${REPOSITORY}/blob/main/examples/openai-responses.mjs">Run the Responses API example →</a></p></section>

<section class="card" id="claude"><h3>Claude</h3>
<p class="muted">Claude Code supports the remote HTTP endpoint directly. No local server or Docker image is required.</p>
<pre>claude mcp add --transport http \
  mcpqueen https://mcpqueen.com/mcp</pre>
<p><a href="/mcp-info">Review every MCP Queen tool →</a></p></section>

<section class="card" id="langchain"><h3>LangChain</h3>
<p class="muted">Load the remote tools with <code>MultiServerMCPClient</code>. The repository example calls <code>search_servers</code> directly, so it needs no model key.</p>
<pre>client = MultiServerMCPClient({
  "mcpqueen": {
    "transport": "http",
    "url": "https://mcpqueen.com/mcp"
  }
})</pre>
<p><a href="${EXAMPLES}/integrations/langchain">Run the LangChain example →</a></p></section>

<section class="card" id="llamaindex"><h3>LlamaIndex</h3>
<p class="muted">Use <code>BasicMCPClient</code> for a direct tool call, or expose the read-only subset to an agent deliberately.</p>
<pre>client = BasicMCPClient(
  "https://mcpqueen.com/mcp"
)
result = await client.call_tool(
  "search_servers", {"query": "postgres"}
)</pre>
<p><a href="${EXAMPLES}/integrations/llamaindex">Run the LlamaIndex example →</a></p></section>

<section class="card" id="cloudflare"><h3>Cloudflare Agents</h3>
<p class="muted">Call <code>addMcpServer()</code> from an Agent, then expose only the intended read-only MCP Queen tools to the model.</p>
<pre>async onStart() {
  await this.addMcpServer(
    "mcpqueen",
    "https://mcpqueen.com/mcp"
  );
}</pre>
<p><a href="${EXAMPLES}/integrations/cloudflare-agent">Run the Cloudflare Agent example →</a></p></section>

<section class="card" id="huggingface"><h3>Hugging Face</h3>
<p class="muted">Hugging Face Inference Providers' Responses API accepts a remote MCP server URL and an explicit read-only tool allowlist. Model-provider credentials remain separate from MCP Queen.</p>
<pre>{
  "type": "mcp",
  "server_label": "mcpqueen",
  "server_url": "https://mcpqueen.com/mcp",
  "allowed_tools": ["search_servers", "search_tools"]
}</pre>
<p><a href="${EXAMPLES}/integrations/huggingface">Run the Hugging Face example →</a></p></section>
</div>

<h3>Recommended agent flow</h3>
<div class="card"><p><strong>Find → inspect evidence → decide → connect direct.</strong></p>
<ol>
<li>Call <code>search_servers</code> or <code>search_tools</code> for the task.</li>
<li>Call <code>get_server_grade</code> and <code>get_trust_receipt</code> for candidates.</li>
<li>State which evidence is observed, provisional, or unaudited.</li>
<li>Evaluate the selected server's own permissions, authentication, and data boundary.</li>
<li>Only then configure or authorize that server in a separate step.</li>
</ol></div>

<h3>Questions developers ask</h3>
${integrationFaqs.map(({ question, answer }) => `<div class="card"><p><strong>${question}</strong></p><p class="muted">${answer}</p></div>`).join("")}

<p class="muted">These anchored guides share one canonical page because they serve one connection task without duplicating thin setup pages. Runnable examples and their dependency instructions live in the <a href="${EXAMPLES}">MCP Queen repository</a>. See the <a href="/demo">prepared workflow demo page</a> for the chapter and caption structure.</p>`,
};

const demoChapters = [
  ["0:00", "MCP Queen", "What the evidence and discovery layer does."],
  ["0:10", "Developer setup", "The public, no-auth Streamable HTTP endpoint."],
  ["0:30", "Find a server by task", "Use search_servers and retain evidence caveats."],
  ["1:10", "Inspect an operational grade", "Read the observations behind each point."],
  ["1:42", "Search tools by capability", "Search observed tools rather than metadata alone."],
  ["2:20", "Inspect a Trust Receipt", "Separate available observations from unaudited dimensions."],
  ["3:02", "Reviewed field evidence", "Keep qualitative reports separate from grades."],
  ["3:38", "Current operational comparison", "Compare score, latency, and tool count without inferring safety."],
  ["4:08", "Field-report safety boundary", "Do not create feedback without actual use."],
  ["4:35", "Mobile discovery", "Repeat the discovery workflow in a compatible mobile client."],
  ["5:00", "Mobile evidence review", "Preserve observed-versus-unaudited distinctions."],
  ["5:25", "Find, verify, connect", "Connect directly only after the evidence review."],
];

const demo = {
  ...DISCOVERY_PAGES["/demo"],
  jsonld: {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE}/demo#webpage`,
        url: `${SITE}/demo`,
        name: "MCP Queen discovery and evidence demo",
        description: DISCOVERY_PAGES["/demo"].description,
        about: { "@id": `${SITE}/#software` },
      },
      breadcrumbs("/demo", "Demo"),
    ],
  },
  body: `
<h2>MCP Queen discovery and evidence demo</h2>
<p class="muted">This page is ready for a genuine walkthrough of server discovery, tool search, operational evidence, Trust Receipts, and the field-report safety boundary.</p>

<div class="card" id="demo-status" data-video-status="not-published">
<p><strong>Footage status: not published</strong></p>
<p class="muted">No public video is available yet. The player intentionally has no media source and makes no claim that footage exists. It will be activated only after genuine cross-platform footage is recorded, hosted at a stable public URL, and verified.</p>
<video id="demo-player" controls preload="metadata" aria-describedby="demo-status" style="display:block;width:100%;min-height:240px;background:rgba(0,0,0,.35);border:1px solid var(--line);border-radius:10px">
  <track kind="captions" src="/demo/openai-demo-captions.vtt" srclang="en" label="English" default>
  Your browser does not support HTML video.
</video>
<p class="faint">Prepared caption track: <a href="/demo/openai-demo-captions.vtt">WebVTT</a>. Timing will be checked against the final edit before the player receives a source.</p>
</div>

<h3 id="chapters">Prepared chapters</h3>
<p class="muted">These slots define the intended reviewer flow. Final timestamps and labels will be reconciled to the genuine edit before publication.</p>
<table class="evtable">
<thead><tr><th>Start</th><th>Chapter</th><th>Developer intent</th></tr></thead>
<tbody>${demoChapters.map(([time, title, detail]) => `<tr><td>${time}</td><td>${title}</td><td class="muted">${detail}</td></tr>`).join("")}</tbody>
</table>

<section id="transcript" aria-labelledby="transcript-heading">
<h3 id="transcript-heading">Transcript slots</h3>
<p class="muted">The final accessible transcript will be generated from the caption track after the hosted footage and timing are verified. Each chapter above already has a stable slot so transcript text, tool names, and evidence caveats can be reviewed together.</p>
<div class="card">
<p><strong>Required transcript checks</strong></p>
<ul>
<li>Tool names and prompts match the genuine on-screen calls.</li>
<li>Operational grades are described as observations, not security certification.</li>
<li>Trust Receipt dimensions remain separate and missing evidence is labeled unaudited.</li>
<li>The negative feedback test does not create a fabricated field report.</li>
<li>Any platform labels match the footage actually recorded.</li>
</ul>
</div>
</section>

<h3>Follow the evidence path</h3>
<p><a href="/integrations">Connect MCP Queen</a> · <a href="/mcp-info">Review the tools</a> · <a href="/architecture">Understand the trust boundaries</a> · <a href="/registry#methodology">Read the methodology</a> · <a href="/field-reports">Browse reviewed field reports</a></p>
<p class="faint">Video structured data is intentionally absent. It will be added only after a real public video URL, thumbnail, upload date, duration, transcript, and final chapter timing exist and have been validated.</p>`,
};

const pages = {
  "/architecture": architecture,
  "/integrations": integrations,
  "/demo": demo,
};

export function getDiscoveryPage(path) {
  return pages[path] ?? null;
}
