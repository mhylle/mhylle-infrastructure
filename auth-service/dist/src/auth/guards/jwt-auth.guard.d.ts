import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    getRequest(context: ExecutionContext): Request;
    handleRequest(err: any, user: any, info: any, context: ExecutionContext): any;
}
export {};
