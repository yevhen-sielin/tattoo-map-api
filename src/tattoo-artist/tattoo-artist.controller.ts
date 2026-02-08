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
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { TattooArtistService } from './tattoo-artist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/auth.controller';
import type { User as JwtUser } from '../auth/types';
import { SearchArtistsDto } from './dto/search-artists.dto';
import { UpsertArtistDto } from './dto/upsert-artist.dto';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { DEFAULT_SEARCH_LIMIT } from '../config/constants';

@ApiTags('Tattoo Artists')
@Controller('tattoo-artist')
export class TattooArtistController {
  constructor(private readonly tattooArtistService: TattooArtistService) {}

  @Get()
  @ApiOperation({
    summary: 'Search artists by filters (styles, location, name, etc.)',
  })
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
      limit: query.limit ?? DEFAULT_SEARCH_LIMIT,
      skip: query.skip ?? 0,
    });
  }

  @Get('points')
  @ApiOperation({
    summary:
      'Lightweight endpoint returning only coordinates for map clustering. Pass bbox params for viewport filtering.',
  })
  async points(@Query() query: BboxQueryDto) {
    const hasBbox =
      query.swLng != null &&
      query.swLat != null &&
      query.neLng != null &&
      query.neLat != null;

    console.log('[points] hasBbox:', hasBbox, 'query:', JSON.stringify(query));

    try {
      const result = await this.tattooArtistService.findAllPoints(
        hasBbox
          ? {
              swLng: query.swLng!,
              swLat: query.swLat!,
              neLng: query.neLng!,
              neLat: query.neLat!,
            }
          : undefined,
      );
      console.log(
        '[points] result type:',
        typeof result,
        'isArray:',
        Array.isArray(result),
        'length:',
        result?.length,
      );
      return result;
    } catch (err) {
      console.error('[points] ERROR:', err);
      throw err;
    }
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top artists sorted by likes' })
  async top(@Query('limit') limit?: string) {
    const lim = limit != null ? Number(limit) : undefined;
    return this.tattooArtistService.topByLikes(lim);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single artist by user ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  async findOne(@Param('id', ParseUUIDPipe) userId: string) {
    return this.tattooArtistService.findByUserId(userId);
  }

  @Post()
  @ApiOperation({
    summary: "Create or update the current user's artist profile",
  })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async upsertMine(
    @Body() body: UpsertArtistDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.upsertForCurrentUser(user.sub, body);
  }

  @Delete()
  @ApiOperation({ summary: "Delete the current user's artist profile" })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async deleteMine(@CurrentUser() user: JwtUser) {
    return this.tattooArtistService.deleteForCurrentUser(user.sub);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like an artist' })
  @ApiParam({ name: 'id', description: 'Artist UUID' })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async like(
    @Param('id', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.likeArtist(user.sub, artistId);
  }

  @Delete(':id/like')
  @ApiOperation({ summary: 'Unlike an artist' })
  @ApiParam({ name: 'id', description: 'Artist UUID' })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async unlike(
    @Param('id', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.unlikeArtist(user.sub, artistId);
  }

  @Get(':id/like')
  @ApiOperation({ summary: 'Check if current user has liked an artist' })
  @ApiParam({ name: 'id', description: 'Artist UUID' })
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async isLiked(
    @Param('id', ParseUUIDPipe) artistId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.isLikedBy(user.sub, artistId);
  }
}
