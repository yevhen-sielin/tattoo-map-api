import { Test, TestingModule } from '@nestjs/testing';
import { TattooArtistService } from './tattoo-artist.service';

describe('TattooArtistService', () => {
  let service: TattooArtistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TattooArtistService],
    }).compile();

    service = module.get<TattooArtistService>(TattooArtistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
