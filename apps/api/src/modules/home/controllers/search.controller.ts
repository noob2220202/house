import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import { SearchSuggestQueryDto } from '../dto';
import { SearchSuggestService, type SuggestResult } from '../services/search-suggest.service';

@ApiTags('home')
@Controller('search')
export class SearchController {
  constructor(private readonly suggestions: SearchSuggestService) {}

  /** 지역 · 단지 · 중개사무소 autocomplete; an empty `q` answers only `popular`. */
  @Public()
  @Get('suggest')
  suggest(@Query() q: SearchSuggestQueryDto): Promise<SuggestResult> {
    return this.suggestions.suggest(q);
  }
}
