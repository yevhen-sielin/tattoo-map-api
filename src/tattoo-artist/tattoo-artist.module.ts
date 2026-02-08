import { Module } from '@nestjs/common';
import { TattooArtistService } from './tattoo-artist.service';
import { TattooArtistController } from './tattoo-artist.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [PrismaModule, UploadsModule],
  controllers: [TattooArtistController],
  providers: [TattooArtistService],
})
export class TattooArtistModule {}
