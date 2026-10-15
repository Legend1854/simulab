// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { childElements, decodeEntities, escapeXmlAttribute, escapeXmlText, firstChild, parseXml, stripInvalidXmlChars, textContent, XmlError } from '../../../src/services/spreadsheets/ooxml/xml';

describe('parseXml', () => {
  it('parses elements, attributes and text, dropping namespace prefixes and declarations', () => {
    const root = parseXml('<?xml version="1.0"?><x:row r="1" xmlns:x="ns"><x:c r="A1" t=\'s\'><x:v>3</x:v></x:c><x:c r="B1"/></x:row>');
    expect(root.name).toBe('row');
    expect(root.attributes).toEqual({ r: '1' });
    const cells = childElements(root, 'c');
    expect(cells.map((c) => c.attributes.r)).toEqual(['A1', 'B1']);
    expect(cells[0]?.attributes.t).toBe('s');
    expect(textContent(firstChild(cells[0]!, 'v')!)).toBe('3');
  });

  it('decodes predefined entities and numeric character references in text and attributes', () => {
    const root = parseXml('<t a="&quot;x&quot; &amp; y">A &amp; B &lt;c&gt; &#65;&#x42; &apos;q&apos;</t>');
    expect(root.attributes.a).toBe('"x" & y');
    expect(textContent(root)).toBe("A & B <c> AB 'q'");
  });

  it('keeps whitespace inside <t> text elements but drops layout whitespace elsewhere', () => {
    const root = parseXml('<si>\n  <t>  spaced  </t>\n  <t> </t>\n</si>');
    expect(root.children).toHaveLength(2);
    expect(childElements(root, 't').map(textContent)).toEqual(['  spaced  ', ' ']);
  });

  it('reads CDATA as text and skips comments and processing instructions', () => {
    const root = parseXml('<a><!-- note --><?pi x?><![CDATA[<raw> & text]]></a>');
    expect(textContent(root)).toBe('<raw> & text');
  });

  it('ignores a leading byte-order mark', () => {
    expect(parseXml('﻿<?xml version="1.0"?><a/>').name).toBe('a');
  });

  it('accepts attribute values containing ">"', () => {
    expect(parseXml('<a f="x>y"/>').attributes.f).toBe('x>y');
  });

  it('rejects document type declarations, so entity-expansion attacks cannot happen', () => {
    const billionLaughs = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><a>&lol2;</a>';
    expect(() => parseXml(billionLaughs)).toThrow(/Document type declarations are not allowed/);
  });

  it.each([
    ['unknown entity', '<a>&nbsp;</a>', /Unknown entity/],
    ['mismatched tags', '<a><b></a></b>', /Unexpected closing tag/],
    ['unclosed element', '<a><b>', /Unclosed element/],
    ['two roots', '<a/><b/>', /More than one root/],
    ['unquoted attribute', '<a b=1/>', /must be quoted/],
    ['text outside the root', 'hello<a/>', /Text outside the root/],
    ['empty document', '<?xml version="1.0"?>', /no root element/],
    ['bad character reference', '<a>&#x110000;</a>', /Invalid character reference/],
  ])('rejects malformed XML: %s', (_label, xml, message) => {
    expect(() => parseXml(xml)).toThrow(XmlError);
    expect(() => parseXml(xml)).toThrow(message);
  });

  it('decodeEntities leaves text without entities untouched', () => {
    expect(decodeEntities('plain')).toBe('plain');
  });
});

describe('XML writing helpers', () => {
  it('escapes markup characters in text and attributes', () => {
    expect(escapeXmlText('A & B <c>')).toBe('A &amp; B &lt;c&gt;');
    expect(escapeXmlAttribute('say "hi"\nnext')).toBe('say &quot;hi&quot;&#10;next');
  });

  it('removes characters XML 1.0 cannot represent, keeping tabs, newlines and emoji', () => {
    expect(stripInvalidXmlChars('a\u0000b\u0007c\td\ne￾f😀')).toBe('abc\td\nef😀');
  });

  it('round-trips escaped text through the parser', () => {
    const text = 'Fees & "returns" <rounded> it\'s 100%';
    expect(textContent(parseXml(`<t a="${escapeXmlAttribute(text)}">${escapeXmlText(text)}</t>`))).toBe(text);
    expect(parseXml(`<t a="${escapeXmlAttribute(text)}"/>`).attributes.a).toBe(text);
  });
});
