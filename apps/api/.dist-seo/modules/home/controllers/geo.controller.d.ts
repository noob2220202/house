import { GeocodeQueryDto } from '../dto';
import { GeocodeService, type GeocodeItemView } from '../services/geocode.service';
/**
 * Address search with coordinates (중개사무소 등록 신청 주소). Signed-in users only: it proxies a
 * metered external API with the server's keys, so it is also rate-limited per account.
 */
export declare class GeoController {
    private readonly geocode;
    constructor(geocode: GeocodeService);
    search(q: GeocodeQueryDto): Promise<{
        items: GeocodeItemView[];
    }>;
}
