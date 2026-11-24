import type { AdminComplexListItem, AdminComplexView, ComplexAreaTypeView, ComplexPhotoView, Paginated } from '@house/shared';
import { AdminComplexListQueryDto, AreaTypeParamDto, ComplexPhotosDto, CreateAreaTypeDto, CreateComplexDto, IdParamDto, UpdateAreaTypeDto, UpdateComplexDto } from '../dto';
import { ComplexAdminService } from '../services/complex-admin.service';
export declare class AdminComplexesController {
    private readonly admin;
    constructor(admin: ComplexAdminService);
    list(q: AdminComplexListQueryDto): Promise<Paginated<AdminComplexListItem>>;
    get(p: IdParamDto): Promise<AdminComplexView>;
    create(dto: CreateComplexDto): Promise<AdminComplexView>;
    update(p: IdParamDto, dto: UpdateComplexDto): Promise<AdminComplexView>;
    remove(p: IdParamDto): Promise<void>;
    addAreaType(p: IdParamDto, dto: CreateAreaTypeDto): Promise<ComplexAreaTypeView>;
    updateAreaType(p: AreaTypeParamDto, dto: UpdateAreaTypeDto): Promise<ComplexAreaTypeView>;
    removeAreaType(p: AreaTypeParamDto): Promise<void>;
    /** Replaces the 단지 photo list; order = array order. */
    setPhotos(p: IdParamDto, dto: ComplexPhotosDto): Promise<ComplexPhotoView[]>;
}
