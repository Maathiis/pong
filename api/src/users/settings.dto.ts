import { IsBoolean, IsOptional } from 'class-validator';

export class SettingsDto {
  @IsOptional() @IsBoolean() alertOffline?: boolean;
  @IsOptional() @IsBoolean() alertSpeedRecord?: boolean;
  @IsOptional() @IsBoolean() alertMatchPoint?: boolean;
  @IsOptional() @IsBoolean() retroSounds?: boolean;
}
