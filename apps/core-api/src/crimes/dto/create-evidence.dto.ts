import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { EvidenceType } from '@prisma/client';

export class CreateEvidenceDto {
  @IsEnum(EvidenceType)
  type!: EvidenceType;

  @IsString()
  @MinLength(3)
  description!: string;

  // Real file upload/hashing is out of scope for the prototype (Milestone 1,
  // §9) — this lets the chain-of-custody field be exercised without a file
  // storage backend behind it yet.
  @IsOptional()
  @IsString()
  fileHash?: string;
}
