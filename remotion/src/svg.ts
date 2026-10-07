// A handoff SVG file's drawing, without its <svg> wrapper and provenance
// metadata, so it can be inlined into a scene's SVG (where the page's fonts
// apply, unlike in an <img>). The handoff's SVGs still name the UI font
// before Round 11 (the sign's text, sleep's z's); they get today's.
export const innerMarkup = (svg: string) =>
  svg
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
    .replaceAll("Hanken Grotesk", "Figtree")
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "");

export const viewBoxOf = (svg: string): [number, number, number, number] => {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) throw new Error("SVG without a viewBox");
  return match[1].trim().split(/[\s,]+/).map(Number) as [number, number, number, number];
};
