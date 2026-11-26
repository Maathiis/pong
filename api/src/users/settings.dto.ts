import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class SettingsDto {
  @IsOptional() @IsBoolean() alertOffline?: boolean;
  @IsOptional() @IsBoolean() alertSpeedRecord?: boolean;
  @IsOptional() @IsBoolean() alertMatchPoint?: boolean;
  @IsOptional() @IsBoolean() retroSounds?: boolean;
  /** Seuil de l'alerte de vitesse, en multiple de la vitesse de départ (x1,5 à x5). */
  @IsOptional() @IsNumber() @Min(1.5) @Max(5) speedAlertThreshold?: number;
}
