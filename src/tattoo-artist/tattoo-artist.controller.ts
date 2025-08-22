import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { TattooArtistService } from './tattoo-artist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/auth.controller';
import type { User as JwtUser } from '../auth/types';

@Controller('tattoo-artist')
export class TattooArtistController {
  constructor(private readonly tattooArtistService: TattooArtistService) {}

  @Get()
  findAll() {
    return this.tattooArtistService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') userId: string) {
    return this.tattooArtistService.findByUserId(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async upsertMine(
    @Body()
    body: {
      city: string;
      country: string;
      countryCode?: string | null;
      address: string;
      nickname: string;
      description: string;
      styles: string[];
      instagram: string;
      avatar: string;
      photos?: string[];
      lat?: number | null;
      lon?: number | null;
    },
    @CurrentUser() user: JwtUser,
  ) {
    return this.tattooArtistService.upsertForCurrentUser(user.sub, body);
  }
}
