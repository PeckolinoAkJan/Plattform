import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { CompanyModule } from "./modules/company/company.module";
import { LogbookModule } from "./modules/logbook/logbook.module";
import { DispatchModule } from "./modules/dispatch/dispatch.module";
import { MapModule } from "./modules/map/map.module";
import { StatsModule } from "./modules/stats/stats.module";
import { UploadModule } from "./modules/upload/upload.module";
import { RedisModule } from "./common/redis/redis.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    HealthModule,
    PrismaModule,
    AuthModule,
    UserModule,
    CompanyModule,
    LogbookModule,
    DispatchModule,
    MapModule,
    StatsModule,
    UploadModule,
  ],
})
export class AppModule {}
