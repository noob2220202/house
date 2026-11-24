"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const app_config_service_1 = require("../config/app-config.service");
const log_serializers_1 = require("./log-serializers");
let LoggerModule = class LoggerModule {
};
exports.LoggerModule = LoggerModule;
exports.LoggerModule = LoggerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_pino_1.LoggerModule.forRootAsync({
                inject: [app_config_service_1.AppConfig],
                useFactory: (config) => ({
                    // Express 5 / path-to-regexp v8 wildcard syntax (avoids the legacy "*" route warning).
                    forRoutes: [{ path: '{*path}', method: common_1.RequestMethod.ALL }],
                    pinoHttp: {
                        level: config.get('LOG_LEVEL'),
                        transport: config.get('LOG_PRETTY')
                            ? {
                                target: 'pino-pretty',
                                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
                            }
                            : undefined,
                        // RequestContext middleware assigns req.id (from x-request-id or a new UUID) first.
                        genReqId: (req) => {
                            const id = req.id;
                            return typeof id === 'string' ? id : '';
                        },
                        autoLogging: {
                            ignore: (req) => (req.url ?? '').startsWith('/api/v1/health'),
                        },
                        redact: {
                            paths: [
                                'req.headers.cookie',
                                'req.headers.authorization',
                                'req.headers["x-csrf-token"]',
                                'res.headers["set-cookie"]',
                            ],
                            censor: '[redacted]',
                        },
                        serializers: log_serializers_1.logSerializers,
                        customProps: () => ({ service: 'house-api' }),
                    },
                }),
            }),
        ],
    })
], LoggerModule);
//# sourceMappingURL=logger.module.js.map