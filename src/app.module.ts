import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ColumModule } from "./colum/colum.module";
import { UserModule } from "./user/user.module";
import { CardModule } from "./card/card.module";
import { CommentModule } from "./comment/comment.module";
import { BoardModule } from "./board/board.module";
import { AuthModule } from "./auth/auth.module";
import { typeOrmModuleOptions } from "../configs/database.config";
import { configModuleValidationSchema } from "../configs/envValidation.config";
import { CacheModule } from "@nestjs/cache-manager";
import { cacheModuleOptions } from "../configs/cache.config";
import { RedisModule } from "./redis/redis.module";
// import { RedisModule } from '@nestjs-modules/ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configModuleValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmModuleOptions),
    CacheModule.registerAsync({ isGlobal: true, ...cacheModuleOptions }),
    // RedisModule.forRootAsync({
    //   useFactory: () => ({
    //     type: 'single',
    //     url: process.env.REDIS_URL,
    //   }),
    // }),
    AuthModule,
    BoardModule,
    ColumModule,
    UserModule,
    CardModule,
    CommentModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
