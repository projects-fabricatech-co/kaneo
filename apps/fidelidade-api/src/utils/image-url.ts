import * as v from "valibot";

/**
 * A logo URL is the one field a lojista controls that the PRODUCT then renders
 * on a page belonging to somebody else — their customer's card, and the public
 * campaign page a whole neighbourhood scans.
 *
 * Accepting a bare string there has two consequences worth naming:
 *
 * 1. Every customer who opens the card makes a request to a host the LOJISTA
 *    chose and the customer never did, handing it their IP, their user agent and
 *    the time they looked. Requiring http(s) does not remove that, but it keeps
 *    the field from being anything other than an image fetch — no `javascript:`,
 *    no `data:` payload, nothing that could matter the day this value is rendered
 *    somewhere less inert than an `<img src>`.
 * 2. A URL is a promise the browser will make a request. Validating the scheme
 *    at the boundary is the only place that promise can still be refused.
 *
 * The length cap is deliberate too: a megabyte-long `data:` URI in a column that
 * is served on a public page is a denial-of-service on the customer's data plan.
 */
export const MAX_IMAGE_URL_LENGTH = 2048;

export const imageUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(MAX_IMAGE_URL_LENGTH, "Endereço da imagem muito longo"),
  v.url("Informe um endereço de imagem válido"),
  v.check(
    (value) => /^https?:\/\//i.test(value),
    "O endereço da imagem precisa começar com http:// ou https://",
  ),
);

/** Accepts absence and explicit clearing, both of which mean "no logo". */
export const nullableImageUrlSchema = v.nullable(imageUrlSchema);
