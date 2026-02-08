import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { TattooArtistService } from './tattoo-artist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/auth.controller';
import type { User as JwtUser } from '../auth/types';
import { SearchArtistsDto } from './dto/search-artists.dto';
import { UpsertArtistDto } from './dto/upsert-artist.dto';

@Controller('tattoo-artist')
export class TattooArtistController {
  constructor(private readonly tattooArtistService: TattooArtistService) {}

  @Get()
  findAll(@Query() query: SearchArtistsDto) {
    const styles = query.styles
      ? query.styles
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return this.tattooArtistService.search({
      styles,
      countryCode: query.countryCode ? query.countryCode.trim() : null,
      regionCode: query.regionCode ? query.regionCode.trim() : null,
      city: query.city ? query.city.trim() : null,
      q: query.q ?? null,
      beginner: query.beginner === 'true',
      color: query.color === 'true',
      blackAndGray: query.blackAndGray === 'true',
      coverups: query.coverups === 'true',
      centerLat: query.centerLat ?? null,
      centerLon: query.centerLon ?? null,
      radiusKm: query.radiusKm ?? null,
      limit: query.limit ?? 500,
    });
  }

  @Get('top')
  async top(@Query('limit') limit?: string) {
    const lim = limit != null ? Number(limit) : undefined;
    return this.tattooArtistService.topByLikes(lim);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) userId: string) {
    return this.tattooArtistService.findByUserId(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async upsertMine(
    @Body() body: UpsertArtistDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.upsertForCurrentUser(user.sub, body);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async deleteMine(@CurrentUser() user: JwtUser) {
    return this.tattooArtistService.deleteForCurrentUser(user.sub);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  async like(
    @Param('id', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.likeArtist(user.sub, artistId);
  }

  @Delete(':id/like')
  @UseGuards(JwtAuthGuard)
  async unlike(
    @Param('id', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.unlikeArtist(user.sub, artistId);
  }

  @Get(':id/like')
  @UseGuards(JwtAuthGuard)
  async isLiked(
    @Param('id', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.isLikedBy(user.sub, artistId);
  }
}
