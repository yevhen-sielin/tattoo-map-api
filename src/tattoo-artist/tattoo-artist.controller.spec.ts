import { Test, TestingModule } from '@nestjs/testing';
import { TattooArtistController } from './tattoo-artist.controller';
import { TattooArtistService } from './tattoo-artist.service';

describe('TattooArtistController', () => {
  let controller: TattooArtistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TattooArtistController],
      providers: [TattooArtistService],
    }).compile();

    controller = module.get<TattooArtistController>(TattooArtistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
