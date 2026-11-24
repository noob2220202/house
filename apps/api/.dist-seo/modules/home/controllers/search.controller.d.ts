import { SearchSuggestQueryDto } from '../dto';
import { SearchSuggestService, type SuggestResult } from '../services/search-suggest.service';
export declare class SearchController {
    private readonly suggestions;
    constructor(suggestions: SearchSuggestService);
    /** 지역 · 단지 · 중개사무소 autocomplete; an empty `q` answers only `popular`. */
    suggest(q: SearchSuggestQueryDto): Promise<SuggestResult>;
}
