import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { remarkPlugins, rehypePlugins } from "./markdown.ts";

function render(body) {
  return renderToStaticMarkup(
    createElement(Markdown, { remarkPlugins, rehypePlugins }, body),
  );
}

test("raw HTML and GFM are rendered through the shared sanitized pipeline", () => {
  const html = render(
    "<details><summary>詳細</summary>本文</details>\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n- [x] 完了\n\n~~削除~~\n\n```js\nconst x = 1\n```",
  );
  assert.match(html, /<details><summary>詳細<\/summary>本文<\/details>/);
  assert.match(html, /<table>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /<del>削除<\/del>/);
  assert.match(html, /<pre><code class="language-js">/);
});

test("scripts, event handlers, embedded documents, SVG and styles are removed", () => {
  const html = render(
    '<script>alert(1)</script>\n\n<img src="https://example.com/a.png" onerror="alert(1)">\n\n<iframe srcdoc="<script>alert(1)</script>"></iframe>\n\n<svg onload="alert(1)"><a xlink:href="javascript:alert(1)">svg</a></svg>\n\n<p style="background:url(javascript:alert(1))" onclick="alert(1)">残す本文</p>\n\n<form><input autofocus onfocus="alert(1)"></form>',
  );
  assert.doesNotMatch(
    html,
    /<script|<iframe|<svg|<form|onerror|onload|onclick|onfocus|autofocus|srcdoc|style=/i,
  );
  assert.match(html, /残す本文/);
});

test("dangerous URL schemes and encoded javascript URLs are not retained", () => {
  for (const body of [
    '<a href="javascript:alert(1)">link</a>',
    '<a href="jav&#x61;script:alert(1)">link</a>',
    '<a href="java&#x09;script:alert(1)">link</a>',
    '<a href="vbscript:alert(1)">link</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">link</a>',
    '<img src="data:image/svg+xml;base64,PHN2Zz4=">',
    "[link](javascript:alert%281%29)",
  ]) {
    assert.doesNotMatch(render(body), /(?:href|src)="[^"]+"/i);
  }
  assert.match(
    render("[link](https://example.com)"),
    /href="https:\/\/example.com"/,
  );
});

test("user supplied ids and names are prefixed against DOM clobbering", () => {
  const html = render('<a id="location" name="document">link</a>');
  assert.doesNotMatch(html, /(?:id|name)="(?:location|document)"/);
  assert.match(html, /id="user-content-location"/);
});
