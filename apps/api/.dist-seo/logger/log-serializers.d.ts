interface SerializedReqInput {
    id: string;
    method: string;
    url: string;
    remoteAddress?: string;
}
/** pino-http serializers: minimal request/response shapes, with query values scrubbed. */
export declare const logSerializers: {
    req: (req: SerializedReqInput) => {
        id: string;
        method: string;
        url: string;
        ip: string | undefined;
    };
    res: (res: {
        statusCode: number;
    }) => {
        statusCode: number;
    };
};
export {};
