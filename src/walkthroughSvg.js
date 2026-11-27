import { SaxesParser } from "saxes";

const namespace = "http://www.w3.org/2000/svg";
const elements = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "title", "desc"]);
const attributes = new Set([
  "viewBox", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
  "d", "points", "transform", "dx", "dy", "text-anchor", "font-size", "stroke-width",
  "data-part", "data-style", "data-hidden",
]);
const styles = new Set(["surface", "label", "caption", "connector", "arrowhead"]);
export const walkthroughId = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function parseWalkthroughSvg(source) {
  const reject = reason => { throw new Error(`SVG del recorrido inválido: ${reason}.`); };
  if (typeof source !== "string" || new TextEncoder().encode(source).length > 102400) reject("máximo 100 KiB");
  const parser = new SaxesParser();
  const stack = [];
  const parts = new Set();
  let root;
  let geometry = false;

  parser.on("doctype", () => reject("DOCTYPE"));
  parser.on("processinginstruction", () => reject("instrucción de procesamiento"));
  parser.on("opentag", ({ name, attributes: input }) => {
    const parent = stack.at(-1);
    if (!elements.has(name) || stack.length >= 32) reject(`elemento ${name}`);
    if (!parent) {
      const box = (input.viewBox ?? "").trim().split(/[ ,]+/);
      if (name !== "svg" || input.xmlns !== namespace || box.length !== 4 ||
          !box.every(value => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) && Number.isFinite(Number(value))) ||
          !(Number(box[2]) > 0 && Number(box[3]) > 0)) reject("raíz con xmlns y viewBox requeridos");
    } else if (name === "svg" || "xmlns" in input || "viewBox" in input) reject(`elemento ${name}`);

    const props = Object.create(null);
    for (const [key, value] of Object.entries(input)) {
      if (key === "xmlns") continue;
      if (!attributes.has(key)) reject(`atributo ${key}`);
      props[key] = value;
    }
    if (props["data-style"] !== undefined && !styles.has(props["data-style"])) reject("data-style desconocido");
    const part = props["data-part"];
    if (part !== undefined) {
      if (!parent || !walkthroughId(part) || parts.has(part)) reject(`data-part ${part}`);
      parts.add(part);
    }
    if (props["data-hidden"] !== undefined && (props["data-hidden"] !== "true" || part === undefined)) {
      reject("data-hidden requiere un data-part y el valor true");
    }

    const node = { name, props, children: [] };
    if (parent) parent.children.push(node);
    else root = node;
    if (!["svg", "g", "title", "desc"].includes(name)) geometry = true;
    stack.push(node);
  });
  const addText = value => {
    const node = stack.at(-1);
    if (node && ["text", "tspan", "title", "desc"].includes(node.name)) node.children.push(value);
    else if (value.trim()) reject("texto fuera de un elemento de texto");
  };
  parser.on("text", addText);
  parser.on("cdata", addText);
  parser.on("closetag", () => stack.pop());
  parser.write(source).close();
  if (!root || !geometry) reject("sin geometría ni texto");
  return { root, parts };
}
