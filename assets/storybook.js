// Storybook strip: previous / current / next teardown plus one dot per teardown,
// linking to the same kind of page (article, trace or diagram) in each one, and
// a switcher between those three pages for the current teardown.
// Order and names come from the homepage cards, so a new teardown shows up here
// as soon as its card is added to index.html.
//
//   <script src="../assets/storybook.js" data-kind="article|trace|diagram"
//           data-after="<selector to insert the strip after>"
//           data-bottom="<selector to append a prev/next footer to>"  (optional)
//           data-keys></script>  (optional: ←/→ keys page between teardowns)
(function () {
  const me = document.currentScript;
  const { kind, after, bottom } = me.dataset;
  const root = new URL("../", me.src); // this file lives in <root>/assets/

  // which homepage link on a card is which kind of page, in switcher order
  const PICK = {
    article: (a, slug) => a.getAttribute("href") === slug + "/",
    diagram: a => a.getAttribute("href").startsWith("diagrams/template.html?"),
    trace: (a, slug) => a.getAttribute("href") === slug + "/trace.html",
  };
  const VIEW_NAMES = { article: "Article", diagram: "Interactive diagram", trace: "Live turn" };

  const currentSlug = kind === "diagram"
    ? ((new URLSearchParams(location.search).get("data") || "").match(/^\.\.\/([\w-]+)\//) || [])[1]
    : decodeURIComponent(location.pathname.slice(root.pathname.length)).split("/")[0];

  const css = `
    .storybook { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;
                 font-size: 13px; line-height: 1.4; }
    .storybook a { color: #a89880; text-decoration: none; }
    .storybook a:hover { color: #ece1d3; }
    .storybook .prev, .storybook .next { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .storybook .next { text-align: right; }
    .storybook .num { color: #d08c4e; font-variant-numeric: tabular-nums; }
    .storybook .here { display: flex; flex-direction: column; align-items: center; gap: 5px; }
    .storybook .here-label { color: #ece1d3; font-weight: 600; }
    .storybook .dots { display: flex; gap: 6px; }
    .storybook .dots a { width: 8px; height: 8px; border-radius: 50%; background: #3a2f26; }
    .storybook .dots a:hover { background: #a89880; }
    .storybook .dots a.current { background: #d08c4e; }
    .storybook .views { display: flex; gap: 4px; margin-top: 2px; font-size: 12px; }
    .storybook .views > * { padding: 2px 10px; border: 1px solid #3a2f26; border-radius: 12px; }
    .storybook .views a:hover { border-color: #a89880; }
    .storybook .views .current { color: #161210; background: #d08c4e; border-color: #d08c4e; font-weight: 600; }
    .storybook.top { padding: 8px 20px; border-bottom: 1px solid #3a2f26; }
    .storybook.inline { padding: 0 0 14px; margin-bottom: 32px; }
    .storybook.foot { padding: 16px 0 0; margin-top: 48px; border-top: 1px solid #3a2f26;
                      grid-template-columns: 1fr 1fr; font-size: 15px; }
    @media (max-width: 600px) { .storybook .prev .name, .storybook .next .name { display: none; } }`;

  fetch(new URL("index.html", root)).then(r => r.text()).then(html => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [...doc.querySelectorAll(".article[id]")].map(card => {
      const links = [...card.querySelectorAll("a")], views = {};
      for (const k in PICK) {
        const a = links.find(a => PICK[k](a, card.id));
        if (a) views[k] = new URL(a.getAttribute("href"), root).href;
      }
      const m = (card.querySelector("h2")?.textContent || "").match(/^(#\d+)\s*\S\s*([^:]+)/);
      return views[kind] && { slug: card.id, href: views[kind], views,
                              num: m ? m[1] : "", name: m ? m[2].trim() : card.id };
    }).filter(Boolean);
    const i = items.findIndex(it => it.slug === currentSlug);
    if (i < 0) return;
    const prev = items[i - 1], next = items[i + 1];
    const label = it => `<span class="num">${it.num}</span> <span class="name">${it.name}</span>`;
    const side = (it, cls, text) => it
      ? `<a class="${cls}" href="${it.href}" title="${it.num} ${it.name}">${text}</a>` : `<span></span>`;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const anchor = document.querySelector(after);
    const top = document.createElement("nav");
    // the diagram gets a full-width bar under its header; articles and traces
    // sit in their text column (decided by page kind, not window width)
    const inColumn = kind !== "diagram";
    const maxW = getComputedStyle(anchor).maxWidth;
    top.className = "storybook " + (inColumn ? "inline" : "top");
    if (inColumn && maxW !== "none") { top.style.maxWidth = maxW; top.style.margin = "0 auto 32px"; }
    top.innerHTML = side(prev, "prev", prev && `&larr; ${label(prev)}`) +
      `<div class="here"><span class="here-label">${label(items[i])} &middot; ${i + 1} of ${items.length}</span>
       <div class="dots">${items.map((it, j) =>
         `<a href="${it.href}" title="${it.num} ${it.name}"${j === i ? ' class="current"' : ""}></a>`).join("")}</div>
       <div class="views">${Object.entries(items[i].views).map(([k, href]) => k === kind
         ? `<span class="current">${VIEW_NAMES[k]}</span>` : `<a href="${href}">${VIEW_NAMES[k]}</a>`).join("")}</div></div>` +
      side(next, "next", next && `${label(next)} &rarr;`);
    anchor.insertAdjacentElement("afterend", top);
    if (inColumn) anchor.style.marginBottom = "12px";

    if (bottom) {
      const foot = document.createElement("nav");
      foot.className = "storybook foot";
      foot.innerHTML = side(prev, "prev", prev && `&larr; ${label(prev)}`) +
        side(next, "next", next && `${label(next)} &rarr;`);
      document.querySelector(bottom).appendChild(foot);
    }

    if (me.hasAttribute("data-keys")) window.addEventListener("keydown", e => {
      // leave arrows alone for selection (Shift), form fields, editable or
      // focusable controls, and anything that scrolls sideways
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.target.isContentEditable ||
          e.target.closest("input, textarea, select, button, pre, table")) return;
      if (e.key === "ArrowLeft" && prev) location.href = prev.href;
      if (e.key === "ArrowRight" && next) location.href = next.href;
    });
  }).catch(err => console.warn("storybook nav unavailable:", err)); // e.g. opened via file://
})();
