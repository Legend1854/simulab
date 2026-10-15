/**
 * A small, strict XML reader and writer for the SpreadsheetML parts of an .xlsx file.
 *
 * It supports what workbook files actually contain: elements, attributes, text, the five predefined
 * entities, numeric character references, CDATA, comments and processing instructions. Namespace
 * prefixes are dropped (`x:row` and `row` are the same element), because spreadsheet writers choose
 * prefixes freely and SimuLab only reads SpreadsheetML.
 *
 * Document type declarations (`<!DOCTYPE …>`) are rejected outright. That makes entity-expansion
 * attacks ("billion laughs") impossible, because no custom entities can ever be defined.
 */

export interface XmlElement {
  /** Local name, without any namespace prefix. */
  name: string;
  /** Attributes by local name. Namespace declarations (`xmlns`, `xmlns:*`) are not included. */
  attributes: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

export class XmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XmlError';
  }
}

const PREDEFINED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const localName = (qualified: string): string => {
  const colon = qualified.indexOf(':');
  return colon === -1 ? qualified : qualified.slice(colon + 1);
};

/** Replaces entity and character references. Unknown named entities are an error, not silently kept. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&([^;\s&]{1,10});/g, (_match, ref: string) => {
    if (ref.startsWith('#x') || ref.startsWith('#X')) return codePoint(Number.parseInt(ref.slice(2), 16), ref);
    if (ref.startsWith('#')) return codePoint(Number.parseInt(ref.slice(1), 10), ref);
    const value = PREDEFINED_ENTITIES[ref];
    if (value === undefined) throw new XmlError(`Unknown entity "&${ref};".`);
    return value;
  });
}

function codePoint(value: number, ref: string): string {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) throw new XmlError(`Invalid character reference "&${ref};".`);
  return String.fromCodePoint(value);
}

const NAME_END = /[\s/>=]/;

/** Parses an XML document and returns its root element. Whitespace-only text between elements is dropped. */
export function parseXml(source: string): XmlElement {
  // A leading byte-order mark is allowed and ignored.
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const stack: Array<{ element: XmlElement; qualifiedName: string }> = [];
  let root: XmlElement | null = null;
  let index = 0;

  const fail = (message: string): never => {
    throw new XmlError(`${message} (at character ${index}).`);
  };

  const appendText = (value: string) => {
    // XML whitespace is only space, tab, CR and LF; a non-breaking space is content.
    const isFormatting = /^[ \t\r\n]*$/.test(value);
    const current = stack[stack.length - 1];
    if (!current) {
      if (!isFormatting) fail('Text outside the root element');
      return;
    }
    // Whitespace between elements is layout, except inside <t> text elements, where it is content.
    if (isFormatting && current.element.name !== 't') return;
    current.element.children.push(value);
  };

  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open === -1) {
      appendText(decodeEntities(text.slice(index)));
      break;
    }
    if (open > index) appendText(decodeEntities(text.slice(index, open)));
    index = open;

    if (text.startsWith('<?', index)) {
      const end = text.indexOf('?>', index);
      if (end === -1) fail('Unterminated processing instruction');
      index = end + 2;
    } else if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index);
      if (end === -1) fail('Unterminated comment');
      index = end + 3;
    } else if (text.startsWith('<![CDATA[', index)) {
      const end = text.indexOf(']]>', index);
      if (end === -1) fail('Unterminated CDATA section');
      appendText(text.slice(index + 9, end));
      index = end + 3;
    } else if (text.startsWith('<!', index)) {
      fail('Document type declarations are not allowed');
    } else if (text.startsWith('</', index)) {
      const end = text.indexOf('>', index);
      if (end === -1) fail('Unterminated closing tag');
      const name = text.slice(index + 2, end).trim();
      const current = stack.pop();
      if (!current || current.qualifiedName !== name) fail(`Unexpected closing tag </${name}>`);
      index = end + 1;
    } else {
      index += 1;
      const nameStart = index;
      while (index < text.length && !NAME_END.test(text.charAt(index))) index += 1;
      const qualifiedName = text.slice(nameStart, index);
      if (qualifiedName === '') fail('Missing element name');
      const element: XmlElement = { name: localName(qualifiedName), attributes: {}, children: [] };

      // Attributes, then ">" or "/>".
      let selfClosing = false;
      for (;;) {
        while (index < text.length && /\s/.test(text.charAt(index))) index += 1;
        const char = text.charAt(index);
        if (char === '') fail(`Unterminated tag <${qualifiedName}>`);
        if (char === '>') {
          index += 1;
          break;
        }
        if (char === '/' && text.charAt(index + 1) === '>') {
          index += 2;
          selfClosing = true;
          break;
        }
        const attrStart = index;
        while (index < text.length && !NAME_END.test(text.charAt(index))) index += 1;
        const attrName = text.slice(attrStart, index);
        while (/\s/.test(text.charAt(index))) index += 1;
        if (attrName === '' || text.charAt(index) !== '=') fail(`Malformed attribute in <${qualifiedName}>`);
        index += 1;
        while (/\s/.test(text.charAt(index))) index += 1;
        const quote = text.charAt(index);
        if (quote !== '"' && quote !== "'") fail(`Attribute "${attrName}" must be quoted`);
        const valueEnd = text.indexOf(quote, index + 1);
        if (valueEnd === -1) fail(`Unterminated value for attribute "${attrName}"`);
        const value = decodeEntities(text.slice(index + 1, valueEnd));
        index = valueEnd + 1;
        if (attrName === 'xmlns' || attrName.startsWith('xmlns:')) continue;
        const key = localName(attrName);
        if (!(key in element.attributes)) element.attributes[key] = value;
      }

      const parent = stack[stack.length - 1];
      if (parent) parent.element.children.push(element);
      else if (root) fail('More than one root element');
      else root = element;
      if (!selfClosing) stack.push({ element, qualifiedName });
    }
  }

  if (stack.length > 0) throw new XmlError(`Unclosed element <${stack[stack.length - 1]?.qualifiedName ?? ''}>.`);
  if (!root) throw new XmlError('The document has no root element.');
  return root;
}

/* ------------------------------------------------------------------ */
/* Navigation helpers                                                 */
/* ------------------------------------------------------------------ */

export const childElements = (element: XmlElement, name?: string): XmlElement[] =>
  element.children.filter((node): node is XmlElement => typeof node !== 'string' && (name === undefined || node.name === name));

export const firstChild = (element: XmlElement, name: string): XmlElement | undefined =>
  element.children.find((node): node is XmlElement => typeof node !== 'string' && node.name === name);

/** All text inside an element, including nested elements, in document order. */
export function textContent(node: XmlNode): string {
  if (typeof node === 'string') return node;
  return node.children.map(textContent).join('');
}

/* ------------------------------------------------------------------ */
/* Writing                                                            */
/* ------------------------------------------------------------------ */

/**
 * Removes characters that XML 1.0 cannot represent at all (most control characters and unpaired
 * surrogates). Without this, a stray control character in a scenario description would make the
 * exported file unreadable.
 */
export function stripInvalidXmlChars(text: string): string {
  return text.replace(/[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu, '');
}

export const escapeXmlText = (text: string): string =>
  stripInvalidXmlChars(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeXmlAttribute = (text: string): string =>
  escapeXmlText(text).replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
