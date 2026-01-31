import { IsString, IsDateString, IsBoolean, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { PetSex } from '../enums/pet.enum';

export class CreatePetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEnum(PetSex)
  sex: PetSex;

  @IsNotEmpty()
  @IsDateString()
  birthDate: string;

  @IsNotEmpty()
  @IsString()
  breedId: string;

  @IsOptional()
  @IsBoolean()
  isSpayedNeutered?: boolean;
}
