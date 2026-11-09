import { SaxesParser } from "saxes";

const elements = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "title", "desc"]);
const attributes = new Set(["xmlns", "viewBox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2", "points", "transform"]);
export function validateSvgIcon(source) {
  const reject = reason => { throw new Error(`SVG inválido: ${reason}`); };
  if (typeof source !== "string" || new TextEncoder().encode(source).length > 102400) reject("máximo 100 KiB");
  const parser = new SaxesParser();
  let depth = 0, geometry = 0;
  parser.on("doctype", () => reject("DOCTYPE no permitido"));
  parser.on("processinginstruction", () => reject("instrucción no permitida"));
  parser.on("opentag", node => {
    if (!elements.has(node.name)) reject(`elemento ${node.name} no permitido`);
    if (depth === 0 && (node.name !== "svg" || node.attributes.xmlns !== "http://www.w3.org/2000/svg" || !/^\s*-?[\d.]+[ ,]+-?[\d.]+[ ,]+[\d.]+[ ,]+[\d.]+\s*$/.test(node.attributes.viewBox || ""))) reject("raíz svg con xmlns y viewBox requeridos");
    for (const [name, value] of Object.entries(node.attributes)) {
      if (!attributes.has(name)) reject(`atributo ${name} no permitido`);
      if (name === "xmlns" && value !== "http://www.w3.org/2000/svg") reject("namespace no permitido");
      if ((name === "fill" || name === "stroke") && !/^(?:none|transparent|currentColor|#[\da-fA-F]{3,8}|[a-zA-Z]+)$/.test(value)) reject("color no permitido");
    }
    if (!["svg", "g", "title", "desc"].includes(node.name)) geometry++;
    depth++;
  });
  parser.on("closetag", () => depth--);
  parser.write(source).close();
  if (!geometry) reject("sin geometría");
  return source;
}
