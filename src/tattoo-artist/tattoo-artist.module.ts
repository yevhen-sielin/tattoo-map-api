import { Module } from '@nestjs/common';
import { TattooArtistService } from './tattoo-artist.service';
import { TattooArtistController } from './tattoo-artist.controller';
import { PrismaModule } from '../../prisma/prisma.module'; // путь от src

@Module({
  imports: [PrismaModule],
  controllers: [TattooArtistController],
  providers: [TattooArtistService],
})
export class TattooArtistModule {}
