import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User as JwtUser } from '../auth/types';
import { SearchArtistsDto } from './dto/search-artists.dto';
import { UpsertArtistDto } from './dto/upsert-artist.dto';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { FindByIdsDto } from './dto/find-by-ids.dto';
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from '../config/constants';

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
  points(@Query() query: BboxQueryDto) {
    const hasBbox =
      query.swLng != null &&
      query.swLat != null &&
      query.neLng != null &&
      query.neLat != null;

    const hasFilters = query.countryCode || query.regionCode || query.city;
    return this.tattooArtistService.findAllPoints(
      hasBbox
        ? {
            swLng: query.swLng!,
            swLat: query.swLat!,
            neLng: query.neLng!,
            neLat: query.neLat!,
          }
        : undefined,
      hasFilters
        ? {
            countryCode: query.countryCode || undefined,
            regionCode: query.regionCode || undefined,
            city: query.city || undefined,
          }
        : undefined,
    );
  }

  @Post('by-ids')
  @ApiOperation({
    summary:
      'Fetch artists by a list of user IDs (used for cluster drill-down)',
  })
  findByIds(@Body() body: FindByIdsDto) {
    return this.tattooArtistService.findByUserIds(body.userIds);
  }

  @Get('top')
  @ApiOperation({ summary: 'Get top artists sorted by likes' })
  async top(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const clamped = Math.max(1, Math.min(limit, MAX_SEARCH_LIMIT));
    return this.tattooArtistService.topByLikes(clamped);
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
