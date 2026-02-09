import { IsArray, ArrayMaxSize, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FindByIdsDto {
  @ApiProperty({
    description: 'Array of user UUIDs to fetch (max 1000)',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsUUID('4', { each: true })
  userIds!: string[];
}
