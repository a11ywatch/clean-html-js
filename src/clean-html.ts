import { Readability, JSDOMParser } from "readability-node";
import { DOMParser, XMLSerializer } from "xmldom-silent";
import UrlParser from "url-parse";
import sanitizeHtml from "sanitize-html";
import { allowedTags, nonTextTags } from "./clean-html-css";
import { fetchHtml } from "./fetch";

export interface ReaderObject {
  length?: number;
  content?: string;
  excerpt?: string;
  title?: string;
  byline: boolean | null;
  dir: string | undefined;
  uri?: {
    spec: string;
    host: string;
    scheme: string;
    prePath: string;
    pathBase: string;
  };
}

export interface Config {
  allowedTags?: string[];
  nonTextTags?: string[];
}

function convertHtmlToXhtml(html: string) {
  try {
    const xmlSerializer = new XMLSerializer();
    const xhtmlDocument = new DOMParser({
      errorHandler: function (level, msg) {
        if (level === "error") {
          throw new Error(`Unable to convert HTML to XHTML: ${msg}`);
        }
      },
    }).parseFromString(html, "text/html");

    return xmlSerializer.serializeToString(xhtmlDocument);
  } catch (e) {
    console.error(e);
  }
}

function createJsDomDocument(xhtml: string) {
  try {
    const jsDomParser = new JSDOMParser();
    jsDomParser.parse(xhtml.trim());

    if (jsDomParser.errorState) {
      throw new Error(
        `Unable to parse XHTML into JsDom ${jsDomParser.errorState}`,
      );
    }

    return jsDomParser.doc;
  } catch (e) {
    console.error(e);
  }
}

function createReadabilityUrl(sourceUrl: string) {
  const sourceUrlParsed = new UrlParser(sourceUrl);

  if (!sourceUrlParsed || sourceUrlParsed.host.length === 0) {
    throw new Error("Invalid or no source url provided");
  }

  return {
    spec: sourceUrlParsed.href,
    host: sourceUrlParsed.host,
    scheme: sourceUrlParsed.protocol.slice(0, -1),
    prePath: `${sourceUrlParsed.protocol}//${sourceUrlParsed.host}`,
    pathBase: `${sourceUrlParsed.protocol}//${
      sourceUrlParsed.host
    }${sourceUrlParsed.pathname.substring(
      0,
      sourceUrlParsed.pathname.lastIndexOf("/") + 1,
    )}`,
  };
}

async function cleanHtml(
  html: string,
  sourceUrl: string,
  config: Config = { allowedTags: [], nonTextTags: [] },
): Promise<ReaderObject> {
  try {
    html = !html && sourceUrl ? await fetchHtml(sourceUrl) : html;
  } catch (e) {
    console.error(e);
  }

  html = sanitizeHtml(html, {
    allowedTags: [
      ...allowedTags,
      ...(config?.allowedTags ? config?.allowedTags : []),
    ],
    nonTextTags: [
      ...nonTextTags,
      ...(config?.nonTextTags ? config?.nonTextTags : []),
    ],
  });

  return new Promise((resolve) => {
    try {
      if (!html) {
        throw new Error(
          "Invalid url or no html provided, please use a html string or url",
        );
      }
      const readabilityUrl = createReadabilityUrl(sourceUrl);
      const xhtml = convertHtmlToXhtml(html);
      const document = createJsDomDocument(xhtml);

      resolve(new Readability(readabilityUrl, document).parse());
    } catch (error) {
      throw new Error("Unable to clean HTML an issue occured");
    }
  });
}

export default cleanHtml;
