/** The principal if any (use on @Public routes that personalize when logged in). */
export declare const CurrentPrincipal: (...dataOrPipes: unknown[]) => ParameterDecorator;
/** The logged-in site user; throws 401 if the request has no user session. */
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
/** The logged-in admin; throws 401 if the request has no admin session. */
export declare const CurrentAdmin: (...dataOrPipes: unknown[]) => ParameterDecorator;
