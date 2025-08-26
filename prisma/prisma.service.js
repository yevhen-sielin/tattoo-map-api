"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    async onModuleInit() {
        try {
            const dsn = process.env.DATABASE_URL;
            if (dsn) {
                try {
                    const url = new URL(dsn);
                    const masked = `${url.protocol}//${url.hostname}:${url.port || '5432'}${url.pathname}`;
                    console.log('[Prisma] DATABASE_URL →', masked);
                }
                catch {
                    console.log('[Prisma] DATABASE_URL present but could not be parsed');
                }
            }
            else {
                console.log('[Prisma] DATABASE_URL is not set');
            }
        }
        catch {
        }
        await this.$connect();
        try {
            const rows = await this.$queryRaw `
        select current_database() as db, inet_server_addr() as host, inet_server_port() as port
      `;
            if (Array.isArray(rows) && rows[0]) {
                const { db, host, port } = rows[0];
                console.log(`[Prisma] Connected to db=${db} host=${host ?? 'unknown'} port=${port ?? 'unknown'}`);
            }
        }
        catch {
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)()
], PrismaService);
//# sourceMappingURL=prisma.service.js.map