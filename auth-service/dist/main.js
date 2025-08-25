"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const cookieParser = require("cookie-parser");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
if (!globalThis.crypto) {
    const { webcrypto } = require('crypto');
    globalThis.crypto = webcrypto;
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    }));
    app.use(cookieParser());
    app.enableCors({
        origin: configService.get('NODE_ENV') === 'development'
            ? [
                'http://localhost:8090',
                'http://localhost:4200'
            ]
            : [
                'http://mhylle.com'
            ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.setGlobalPrefix('api');
    const port = configService.get('PORT', 3000);
    await app.listen(port);
    console.log(`🚀 Auth service running on port ${port}`);
    console.log(`🔐 Environment: ${configService.get('NODE_ENV', 'development')}`);
}
bootstrap().catch((error) => {
    console.error('❌ Failed to start auth service:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map