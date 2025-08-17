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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const users_service_1 = require("../users/users.service");
let AuthService = class AuthService {
    usersService;
    jwtService;
    constructor(usersService, jwtService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async validateUser(email, password) {
        const user = await this.usersService.findByEmail(email);
        if (!user || !user.isActive) {
            return null;
        }
        const isPasswordValid = await this.usersService.validatePassword(password, user.password);
        if (!isPasswordValid) {
            return null;
        }
        return user;
    }
    async login(loginDto) {
        const user = await this.validateUser(loginDto.email, loginDto.password);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = {
            sub: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            apps: user.apps,
            roles: user.roles,
        };
        const access_token = this.jwtService.sign(payload);
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                permissions: {
                    apps: user.apps,
                    roles: user.roles,
                },
            },
            access_token,
        };
    }
    async validateToken(token) {
        try {
            const payload = this.jwtService.verify(token);
            const user = await this.usersService.findOne(payload.sub);
            return user && user.isActive ? user : null;
        }
        catch {
            return null;
        }
    }
    async getUserFromPayload(payload) {
        const user = await this.usersService.findOne(payload.sub);
        return user && user.isActive ? user : null;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map