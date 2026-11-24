import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { ApiErrorBody } from '@house/shared';
interface Rendered {
    status: number;
    body: ApiErrorBody;
}
/** Converts any thrown value into the safe error shape `{ code, message, details?, requestId }`. */
export declare function renderException(exception: unknown): Rendered;
export declare class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
}
export {};
