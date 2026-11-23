import { redactUrl } from './redact-url';

interface SerializedReqInput {
  id: string;
  method: string;
  url: string;
  remoteAddress?: string;
}

/** pino-http serializers: minimal request/response shapes, with query values scrubbed. */
export const logSerializers = {
  // pino-http hands us req.originalUrl as `url`; query values may carry OAuth codes,
  // phone numbers or map coordinates, so they are scrubbed before logging.
  req: (req: SerializedReqInput) => ({
    id: req.id,
    method: req.method,
    url: redactUrl(req.url),
    ip: req.remoteAddress,
  }),
  res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
};
