const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const applyMappingsToText = (text, mappings, state) => {
  let out = text;
  for (const mapping of mappings) {
    if (state.count >= state.max) break;
    const keyword = String(mapping.keyword || '').trim();
    const url = String(mapping.url || '').trim();
    if (!keyword || !url) continue;
    if (out.includes(url)) continue;

    const re = new RegExp(escapeRegExp(keyword), 'i');
    if (!re.test(out)) continue;
    out = out.replace(re, (match) => {
      if (state.count >= state.max) return match;
      state.count += 1;
      return `<a href="${url}">${match}</a>`;
    });
  }
  return out;
};

const applyInternalLinks = (html, mappings, maxLinks) => {
  const raw = String(html || '');
  if (!raw.trim() || !Array.isArray(mappings) || mappings.length === 0) {
    return { html: raw, linksAdded: 0 };
  }

  const state = { count: 0, max: Math.max(0, Number(maxLinks) || 0) };
  if (state.max === 0) return { html: raw, linksAdded: 0 };

  let out = '';
  let i = 0;
  let inAnchor = 0;

  while (i < raw.length) {
    const lt = raw.indexOf('<', i);
    if (lt === -1) {
      const tail = raw.slice(i);
      out += inAnchor > 0 ? tail : applyMappingsToText(tail, mappings, state);
      break;
    }

    const chunk = raw.slice(i, lt);
    out += inAnchor > 0 ? chunk : applyMappingsToText(chunk, mappings, state);

    const gt = raw.indexOf('>', lt);
    if (gt === -1) {
      out += raw.slice(lt);
      break;
    }

    const tag = raw.slice(lt, gt + 1);
    const lower = tag.toLowerCase();
    if (lower.startsWith('<a ') || lower === '<a>') inAnchor += 1;
    if (lower.startsWith('</a')) inAnchor = Math.max(0, inAnchor - 1);
    out += tag;
    i = gt + 1;
  }

  return { html: out, linksAdded: state.count };
};

module.exports = {
  applyInternalLinks,
};

