"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async login(loginDto, response) {
        const result = await this.authService.login(loginDto);
        response.cookie('auth_token', result.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            domain: process.env.COOKIE_DOMAIN || '.mhylle.com',
            maxAge: 24 * 60 * 60 * 1000,
        });
        return {
            success: true,
            data: result.user,
        };
    }
    async logout(response) {
        response.clearCookie('auth_token', {
            domain: process.env.COOKIE_DOMAIN || '.mhylle.com',
        });
        return {
            success: true,
            message: 'Logged out successfully',
        };
    }
    async validate(request) {
        const token = request.cookies?.auth_token;
        if (!token) {
            throw new common_1.UnauthorizedException('No authentication token found');
        }
        const user = await this.authService.validateToken(token);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid token');
        }
        return {
            success: true,
            data: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                permissions: {
                    apps: user.apps,
                    roles: user.roles,
                },
            },
        };
    }
    health() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'auth-service',
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('logout'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('validate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "validate", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "health", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map