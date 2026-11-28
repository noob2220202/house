import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { isUserPrincipal, type Principal } from '../../../common/auth/principal';
import { RequestContext } from '../../../common/context/request-context';
import { AppConfig } from '../../../config/app-config.service';
import { anonymousIdentity } from '../../ads/domain/visitor';

/** Who sent an inquiry or a contact event. */
export interface InquiryVisitor {
  /** Signed-in member (session on the main site); null = guest. */
  userId: string | null;
  /**
   * Keyed hash of the client's network (guests only): the IPv4 address or the IPv6 /64 (one
   * subscriber owns a whole /64, so rotating addresses inside it must not mint new guests); null
   * when the address is unknown.
   */
  visitorHash: string | null;
}

/**
 * Identifies guests without storing their address: an HMAC (purpose-bound subkey of
 * COOKIE_SECRET) of `req.ip`'s network (IPv4 address / IPv6 /64, `anonymousIdentity`), which
 * follows TRUST_PROXY. Used for the per-guest daily cap and the
 * contact-event dedupe, and stored on guest rows (`inquiries.visitor_hash`) until retention.
 */
@Injectable()
export class InquiryVisitorService {
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    this.key = createHmac('sha256', config.get('COOKIE_SECRET'))
      .update('inquiries:visitor-key')
      .digest();
  }

  current(principal: Principal | undefined): InquiryVisitor {
    if (isUserPrincipal(principal)) return { userId: principal.userId, visitorHash: null };
    return { userId: null, visitorHash: this.hashIp(RequestContext.current()?.ip) };
  }

  /** 64 hex chars (fits `visitor_hash VARCHAR(64)`); null without an address. */
  hashIp(ip: string | undefined): string | null {
    const network = anonymousIdentity(ip);
    if (!network) return null;
    return createHmac('sha256', this.key).update(network).digest('hex');
  }

  /** Subject of the daily caps / dedupe keys: the member, else the hashed address. */
  subject(v: InquiryVisitor): string | null {
    if (v.userId) return `u:${v.userId}`;
    return v.visitorHash ? `ip:${v.visitorHash}` : null;
  }
}
